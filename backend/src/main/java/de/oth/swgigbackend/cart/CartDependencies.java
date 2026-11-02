package de.oth.swgigbackend.cart;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Connects cart ports; public sample data requires the local cart-demo profile. */
@Configuration
class CartDependencies {
    static final UUID SESSION_ONE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID SESSION_TWO = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final UUID PASTA = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID WATER = UUID.fromString("10000000-0000-0000-0000-000000000002");
    static final UUID CHEESE = UUID.fromString("20000000-0000-0000-0000-000000000001");

    /** Rejects guest access until F03 supplies session validation. */
    @Bean
    @Profile("!cart-demo")
    GuestSessionAccess guestSessionAccess() {
        return token -> { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Guest session access is not connected yet."); };
    }

    /** Rejects menu access until F06/F07 supplies product data. */
    @Bean
    @Profile("!cart-demo")
    CartCatalog cartCatalog() {
        return () -> { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "The product catalog is not connected yet."); };
    }

    /** Resolves public demo tokens to two isolated table sessions. */
    @Bean
    @Profile("cart-demo")
    GuestSessionAccess demoGuestSessionAccess() {
        return token -> switch (token) {
            case "demo-table-1" -> SESSION_ONE;
            case "demo-table-2" -> SESSION_TWO;
            case "demo-closed-table" -> throw new ResponseStatusException(HttpStatus.CONFLICT, "The dining session is closed.");
            default -> throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired guest access.");
        };
    }

    /** Supplies a small menu for local cart development. */
    @Bean
    @Profile("cart-demo")
    CartCatalog demoCartCatalog() {
        var cheese = new CartCatalog.Extra(CHEESE, "Parmesan", new BigDecimal("1.50"), 2);
        return () -> List.of(
                new CartCatalog.Product(PASTA, "Pasta", new BigDecimal("12.50"), true, true, Map.of(CHEESE, cheese)),
                new CartCatalog.Product(WATER, "Mineralwasser", new BigDecimal("3.20"), true, true, Map.of()));
    }
}
