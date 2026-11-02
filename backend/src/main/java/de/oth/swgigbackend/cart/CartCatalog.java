package de.oth.swgigbackend.cart;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Integration port for F06/F07. All prices and assignments come from maintained menu data. */
public interface CartCatalog {
    /** Returns current products, prices and permitted extras. */
    List<Product> products();

    /** An allowed extra with its per-serving surcharge and limit. */
    record Extra(UUID id, String name, BigDecimal surcharge, int maximumQuantity) {}

    /** A maintained product with its current availability and extras. */
    record Product(UUID id, String name, BigDecimal price, boolean active, boolean available,
                   Map<UUID, Extra> extras) {
        /** Copies extras so callers cannot change the catalog entry. */
        public Product {
            extras = Map.copyOf(extras);
        }
    }
}
