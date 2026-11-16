package de.oth.swgigbackend.cart;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Request and response records shared by the cart API. */
public final class CartDtos {
    /** Prevents instantiation of this record namespace. */
    private CartDtos() {}

    /** An extra and its requested quantity per serving. */
    public record ExtraInput(@NotNull UUID extraId, @Min(1) @Max(99) int quantity) {}

    /** A product selection; prices always come from the server. */
    public record ItemInput(@NotNull UUID productId, @Min(1) @Max(99) int quantity,
                            @Size(max = 500) String note,
                            @NotNull @Size(max = 50) List<@NotNull @Valid ExtraInput> extras) {}

    /** A selected extra with its current surcharge. */
    public record ExtraView(UUID extraId, String name, int quantity, BigDecimal surcharge) {}

    /** A cart line with current prices and validation errors. */
    public record ItemView(UUID id, UUID productId, String name, int quantity, String note,
                           List<ExtraView> extras, BigDecimal unitPrice, BigDecimal total,
                           List<String> errors) {}

    /** The cart total and whether every selection is valid. */
    public record DraftView(UUID id, List<ItemView> items, BigDecimal total, String currency,
                            boolean canSubmit) {}

    /** One page of active menu products. */
    public record ProductPage(List<CartCatalog.Product> content, int page, int size, int totalElements) {}
}
