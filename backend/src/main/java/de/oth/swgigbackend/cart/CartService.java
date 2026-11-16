package de.oth.swgigbackend.cart;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Manages session-scoped carts using current menu rules. */
@Service
@Transactional
public class CartService {
    private final OrderDraftRepository drafts;
    private final GuestSessionAccess sessions;
    private final CartCatalog catalog;

    /** Connects persistence, guest access and catalog ports. */
    public CartService(OrderDraftRepository drafts, GuestSessionAccess sessions, CartCatalog catalog) {
        this.drafts = drafts;
        this.sessions = sessions;
        this.catalog = catalog;
    }

    /** Reads the current cart without creating an empty record. */
    @Transactional(readOnly = true)
    public CartDtos.DraftView current(String token) {
        var sessionId = sessions.requireOpenSession(token);
        return view(drafts.findBySessionId(sessionId).orElse(null), productsById());
    }

    /** Filters and pages active products in name order. */
    @Transactional(readOnly = true)
    public CartDtos.ProductPage products(String token, String search, int page, int size) {
        sessions.requireOpenSession(token);
        var term = search.strip().toLowerCase(Locale.ROOT);
        var products = catalog.products().stream().filter(CartCatalog.Product::active)
                .filter(product -> product.name().toLowerCase(Locale.ROOT).contains(term))
                .sorted(Comparator.comparing(CartCatalog.Product::name).thenComparing(CartCatalog.Product::id))
                .toList();
        int start = (int) Math.min((long) page * size, products.size());
        return new CartDtos.ProductPage(products.subList(start, Math.min(start + size, products.size())),
                page, size, products.size());
    }

    /** Validates and persists a new cart line. */
    public CartDtos.DraftView add(String token, CartDtos.ItemInput input) {
        var sessionId = sessions.requireOpenSession(token);
        var products = productsById();
        validateInput(input, products);
        var draft = drafts.lockBySessionId(sessionId).orElseGet(() -> drafts.saveAndFlush(new OrderDraft(sessionId)));
        if (draft.items.size() >= 100) {
            throw invalid("A cart may contain at most 100 items.");
        }
        var item = new DraftItem(draft, input.productId());
        item.update(input);
        draft.items.add(item);
        drafts.saveAndFlush(draft);
        return view(draft, products);
    }

    /** Updates an owned line while locking its cart. */
    public CartDtos.DraftView update(String token, UUID itemId, CartDtos.ItemInput input) {
        var draft = requiredDraft(sessions.requireOpenSession(token));
        var item = requiredItem(draft, itemId);
        if (!item.productId.equals(input.productId())) {
            throw invalid("Remove the item and add the new product instead.");
        }
        var products = productsById();
        validateInput(input, products);
        item.update(input);
        drafts.flush();
        return view(draft, products);
    }

    /** Removes an owned line while locking its cart. */
    public CartDtos.DraftView remove(String token, UUID itemId) {
        var draft = requiredDraft(sessions.requireOpenSession(token));
        draft.items.remove(requiredItem(draft, itemId));
        drafts.flush();
        return view(draft, productsById());
    }

    /** Rechecks a nonempty cart; US19 must call this inside its submission transaction. */
    public CartDtos.DraftView validateForSubmission(String token) {
        var sessionId = sessions.requireOpenSession(token);
        var draft = drafts.lockBySessionId(sessionId).orElse(null);
        var result = view(draft, productsById());
        if (!result.canSubmit()) {
            throw invalid("The cart is empty or contains unavailable/invalid items. Review your cart.");
        }
        return result;
    }

    /** Locks the caller’s cart or reports a missing item. */
    private OrderDraft requiredDraft(UUID sessionId) {
        return drafts.lockBySessionId(sessionId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart item not found."));
    }

    /** Loads an active product’s current editing options. */
    @Transactional(readOnly = true)
    public CartCatalog.Product product(String token, UUID productId) {
        sessions.requireOpenSession(token);
        var product = productsById().get(productId);
        if (product == null || !product.active()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product is no longer available. Remove it from the cart.");
        }
        return product;
    }

    /** Finds an item only within its owner’s cart. */
    private DraftItem requiredItem(OrderDraft draft, UUID itemId) {
        return draft.items.stream().filter(item -> item.id.equals(itemId)).findFirst().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart item not found."));
    }

    /** Indexes the current catalog by product ID. */
    private Map<UUID, CartCatalog.Product> productsById() {
        return catalog.products().stream().collect(Collectors.toMap(CartCatalog.Product::id, Function.identity()));
    }

    /** Rejects duplicate extras and invalid product selections. */
    private void validateInput(CartDtos.ItemInput input, Map<UUID, CartCatalog.Product> products) {
        var extras = new HashMap<UUID, Integer>();
        for (var extra : input.extras()) {
            if (extras.put(extra.extraId(), extra.quantity()) != null) {
                throw invalid("An extra may only be selected once per item.");
            }
        }
        var errors = errors(products.get(input.productId()), input.quantity(), extras);
        if (!errors.isEmpty()) { throw invalid(String.join(" ", errors)); }
    }

    /** Checks product availability and quantity limits. */
    private List<String> errors(CartCatalog.Product product, int quantity, Map<UUID, Integer> extras) {
        var errors = new ArrayList<String>();
        if (quantity < 1 || quantity > 99) { errors.add("Quantity must be between 1 and 99."); }
        if (product == null || !product.active() || !product.available()) {
            errors.add("Product is no longer available.");
            return errors;
        }
        extras.forEach((id, count) -> {
            var extra = product.extras().get(id);
            if (extra == null || count < 1 || count > extra.maximumQuantity()) {
                errors.add("An extra is not allowed or exceeds its quantity limit.");
            }
        });
        return errors;
    }

    /** Builds the priced cart; invalid lines suppress its total. */
    private CartDtos.DraftView view(OrderDraft draft, Map<UUID, CartCatalog.Product> products) {
        if (draft == null) { return new CartDtos.DraftView(null, List.of(), money(BigDecimal.ZERO), "EUR", false); }
        var items = draft.items.stream().map(item -> itemView(item, products.get(item.productId))).toList();
        boolean valid = items.stream().allMatch(item -> item.errors().isEmpty());
        var total = valid ? money(items.stream().map(CartDtos.ItemView::total).reduce(BigDecimal.ZERO, BigDecimal::add)) : null;
        return new CartDtos.DraftView(draft.id, items, total, "EUR", valid && !items.isEmpty());
    }

    /** Prices one line; invalid selections have no trustworthy price. */
    private CartDtos.ItemView itemView(DraftItem item, CartCatalog.Product product) {
        var errors = errors(product, item.quantity, item.extras);
        var extras = item.extras.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(entry -> {
            var extra = product == null ? null : product.extras().get(entry.getKey());
            return new CartDtos.ExtraView(entry.getKey(), extra == null ? "Removed extra" : extra.name(),
                    entry.getValue(), extra == null ? null : money(extra.surcharge()));
        }).toList();
        BigDecimal unit = null;
        if (errors.isEmpty()) {
            unit = product.price();
            for (var extra : extras) {
                unit = unit.add(extra.surcharge().multiply(BigDecimal.valueOf(extra.quantity())));
            }
            unit = money(unit);
        }
        return new CartDtos.ItemView(item.id, item.productId, product == null ? "Removed product" : product.name(),
                item.quantity, item.note, extras, unit,
                unit == null ? null : money(unit.multiply(BigDecimal.valueOf(item.quantity))), errors);
    }

    /** Normalizes valid EUR prices to two decimal places. */
    private static BigDecimal money(BigDecimal value) { return value.setScale(2); }
    /** Creates an actionable cart-rule error. */
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
}
