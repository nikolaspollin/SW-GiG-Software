package de.oth.swgigbackend.cart;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** Exposes the current guest session’s cart over HTTP. */
@RestController
@RequestMapping("/api/order-drafts")
@Validated
public class CartController {
    private final CartService carts;

    /** Connects the cart service. */
    public CartController(CartService carts) { this.carts = carts; }

    /** Prevents guest data from entering HTTP caches. */
    @ModelAttribute
    void preventCaching(HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }

    /** Returns the caller’s cart. */
    @GetMapping("/current")
    public CartDtos.DraftView current(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return carts.current(token(authorization));
    }

    /** Lists active menu products with search and pagination. */
    @GetMapping("/products")
    public CartDtos.ProductPage products(@RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "") @Size(max = 100) String search,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return carts.products(token(authorization), search, page, size);
    }

    /** Adds a validated selection to the caller’s cart. */
    @PostMapping("/current/items")
    @ResponseStatus(HttpStatus.CREATED)
    public CartDtos.DraftView add(@RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody CartDtos.ItemInput input) {
        return carts.add(token(authorization), input);
    }

    /** Loads current product options for editing. */
    @GetMapping("/products/{productId}")
    public CartCatalog.Product product(@RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable UUID productId) {
        return carts.product(token(authorization), productId);
    }

    /** Replaces an item’s quantity, extras and note. */
    @PutMapping("/current/items/{itemId}")
    public CartDtos.DraftView update(@RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable UUID itemId, @Valid @RequestBody CartDtos.ItemInput input) {
        return carts.update(token(authorization), itemId, input);
    }

    /** Removes an item owned by the caller’s session. */
    @DeleteMapping("/current/items/{itemId}")
    public CartDtos.DraftView remove(@RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable UUID itemId) {
        return carts.remove(token(authorization), itemId);
    }

    /** Checks the cart without placing an order. */
    @PostMapping("/current/validate")
    public CartDtos.DraftView validate(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return carts.validateForSubmission(token(authorization));
    }

    /** Extracts the required bearer credential. */
    private String token(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ") || authorization.substring(7).isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A valid guest access token is required.");
        }
        return authorization.substring(7);
    }
}
