package de.oth.swgigbackend.cart;

import static de.oth.swgigbackend.cart.CartDependencies.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Exercises cart persistence, authorization and menu rules through HTTP. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("cart-demo")
class CartIntegrationTests {
    private static final String ROOT = "/api/order-drafts";
    @Autowired MockMvc mvc;
    @Autowired OrderDraftRepository drafts;
    @MockitoBean CartCatalog catalog;
    private CartCatalog.Product pasta;
    private CartCatalog.Product water;

    /** Resets carts and supplies a predictable menu. */
    @BeforeEach
    void setup() {
        drafts.deleteAll();
        var cheese = new CartCatalog.Extra(CHEESE, "Parmesan", new BigDecimal("1.50"), 2);
        pasta = new CartCatalog.Product(PASTA, "Pasta", new BigDecimal("12.50"), true, true, Map.of(CHEESE, cheese));
        water = new CartCatalog.Product(WATER, "Water", new BigDecimal("3.20"), true, true, Map.of());
        when(catalog.products()).thenReturn(List.of(pasta, water));
    }

    /** Rejects empty-cart checks without creating records. */
    @Test
    void emptyCartDoesNotCreateDatabaseRecordsAndCannotValidate() throws Exception {
        mvc.perform(get(ROOT + "/current").header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.canSubmit").value(false));
        validateCart().andExpect(status().isUnprocessableEntity());
        assertThat(drafts.count()).isZero();
    }

    /** Verifies saved selections and server-calculated totals. */
    @Test
    void addReloadUpdateAndRemovePersistAndUseServerPrices() throws Exception {
        var id = addPasta(2, 2).andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].unitPrice").value(15.50))
                .andExpect(jsonPath("$.total").value(31.00)).andExpect(jsonPath("$.canSubmit").value(true))
                .andReturn().getResponse().getContentAsString();
        String itemId = JsonPath.read(id, "$.items[0].id");
        mvc.perform(get(ROOT + "/current").header("Authorization", "Bearer demo-table-1"))
                .andExpect(jsonPath("$.items[0].note").value("No salt"))
                .andExpect(jsonPath("$.total").value(31.00));
        mvc.perform(put(ROOT + "/current/items/" + itemId).header("Authorization", "Bearer demo-table-1")
                        .contentType(MediaType.APPLICATION_JSON).content(input(PASTA, 3, "", "[]")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(37.50))
                .andExpect(jsonPath("$.items[0].extras").isEmpty());
        validateCart().andExpect(status().isOk());
        mvc.perform(delete(ROOT + "/current/items/" + itemId).header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.canSubmit").value(false));
        validateCart().andExpect(status().isUnprocessableEntity());
    }

    /** Rejects access to another table’s cart items. */
    @Test
    void guestsCannotReadOrMutateAnotherSessionsCart() throws Exception {
        String body = addPasta(1, 1).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.items[0].id");
        mvc.perform(get(ROOT + "/current").header("Authorization", "Bearer demo-table-2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete(ROOT + "/current/items/" + id).header("Authorization", "Bearer demo-table-2"))
                .andExpect(status().isNotFound());
        mvc.perform(put(ROOT + "/current/items/" + id).header("Authorization", "Bearer demo-table-2")
                        .contentType(MediaType.APPLICATION_JSON).content(input(PASTA, 1, "", "[]")))
                .andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/" + JsonPath.<String>read(body, "$.id"))
                        .header("Authorization", "Bearer demo-table-2")).andExpect(status().isNotFound());
        validateCart().andExpect(jsonPath("$.items.length()").value(1));
    }

    /** Rejects missing, invalid and closed-session access. */
    @Test
    void rejectsMissingInvalidAndClosedSessionCredentials() throws Exception {
        mvc.perform(get(ROOT + "/current")).andExpect(status().isUnauthorized());
        for (String credential : List.of("Basic abc", "Bearer ", "Bearer revoked-token")) {
            mvc.perform(get(ROOT + "/current").header("Authorization", credential))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post(ROOT + "/current/items").header("Authorization", "Bearer demo-closed-table")
                        .contentType(MediaType.APPLICATION_JSON).content(input(PASTA, 1, "", "[]")))
                .andExpect(status().isConflict());
        assertThat(drafts.count()).isZero();
    }

    /** Rejects quantities outside the supported range. */
    @ParameterizedTest
    @ValueSource(ints = {0, -1, 100})
    void rejectsInvalidItemQuantitiesWithoutCreatingCart(int quantity) throws Exception {
        postItem(input(PASTA, quantity, "", "[]")).andExpect(status().isBadRequest());
        assertThat(drafts.count()).isZero();
    }

    /** Rejects malformed selections without writing records. */
    @Test
    void rejectsLongNotesNullExtrasMalformedIdsAndInvalidExtraQuantities() throws Exception {
        postItem(input(PASTA, 1, "", "[]").replace("\"quantity\":1", "\"quantity\":1.5"))
                .andExpect(status().isBadRequest());
        postItem(input(PASTA, 1, "x".repeat(501), "[]")).andExpect(status().isBadRequest());
        postItem(input(PASTA, 1, "", "null")).andExpect(status().isBadRequest());
        postItem(input(PASTA, 1, "", "[null]")).andExpect(status().isBadRequest());
        postItem("{\"productId\":\"invalid\",\"quantity\":1,\"extras\":[]}").andExpect(status().isBadRequest());
        postItem(input(PASTA, 1, "", extras(0))).andExpect(status().isBadRequest());
        postItem(input(PASTA, 1, "", extras(100))).andExpect(status().isBadRequest());
        assertThat(drafts.count()).isZero();
    }

    /** Rejects invalid extra assignments and duplicates. */
    @Test
    void rejectsUnassignedDuplicateAndExcessiveExtras() throws Exception {
        postItem(input(WATER, 1, "", extras(1))).andExpect(status().isUnprocessableEntity());
        addPasta(1, 3).andExpect(status().isUnprocessableEntity());
        String duplicate = "[" + extras(1).substring(1, extras(1).length() - 1) + ","
                + extras(1).substring(1, extras(1).length() - 1) + "]";
        postItem(input(PASTA, 1, "", duplicate)).andExpect(status().isUnprocessableEntity());
        postItem(input(UUID.randomUUID(), 1, "", "[]")).andExpect(status().isUnprocessableEntity());
        assertThat(drafts.count()).isZero();
    }

    /** Preserves the saved item when an edit fails. */
    @Test
    void invalidUpdateRollsBackWithoutChangingExistingItem() throws Exception {
        String body = addPasta(2, 1).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.items[0].id");
        mvc.perform(put(ROOT + "/current/items/" + id).header("Authorization", "Bearer demo-table-1")
                        .contentType(MediaType.APPLICATION_JSON).content(input(PASTA, 5, "", extras(3))))
                .andExpect(status().isUnprocessableEntity());
        validateCart().andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.total").value(28));
    }

    /** Rechecks prices and availability against current menu data. */
    @Test
    void recalculatesCurrentPricesAndRejectsItemsThatBecomeUnavailable() throws Exception {
        String body = addPasta(2, 1).andReturn().getResponse().getContentAsString();
        when(catalog.products()).thenReturn(List.of(new CartCatalog.Product(PASTA, "Pasta",
                new BigDecimal("13.00"), true, true, pasta.extras())));
        validateCart().andExpect(status().isOk()).andExpect(jsonPath("$.total").value(29));
        when(catalog.products()).thenReturn(List.of(new CartCatalog.Product(PASTA, "Pasta",
                pasta.price(), true, false, pasta.extras())));
        mvc.perform(get(ROOT + "/current").header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.canSubmit").value(false))
                .andExpect(jsonPath("$.total").doesNotExist())
                .andExpect(jsonPath("$.items[0].errors").isNotEmpty());
        validateCart().andExpect(status().isUnprocessableEntity());
        mvc.perform(delete(ROOT + "/current/items/" + JsonPath.<String>read(body, "$.items[0].id"))
                .header("Authorization", "Bearer demo-table-1")).andExpect(status().isOk());
    }

    /** Invalidates selections whose menu records were removed. */
    @Test
    void removedExtraOrProductInvalidatesExistingDraft() throws Exception {
        addPasta(1, 1);
        when(catalog.products()).thenReturn(List.of(new CartCatalog.Product(PASTA, "Pasta", pasta.price(),
                true, true, Map.of())));
        validateCart().andExpect(status().isUnprocessableEntity());
        when(catalog.products()).thenReturn(List.of());
        validateCart().andExpect(status().isUnprocessableEntity());
    }

    /** Prevents new selections of unavailable products. */
    @Test
    void inactiveAndSoldOutProductsCannotBeAdded() throws Exception {
        for (boolean active : List.of(false, true)) {
            when(catalog.products()).thenReturn(List.of(new CartCatalog.Product(PASTA, "Pasta", pasta.price(),
                    active, false, Map.of())));
            postItem(input(PASTA, 1, "", "[]")).andExpect(status().isUnprocessableEntity());
        }
    }

    /** Checks product lookup, search and pagination bounds. */
    @Test
    void productSearchIsScopedPaginatedSortedAndBounded() throws Exception {
        mvc.perform(get(ROOT + "/products/" + PASTA).header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Pasta"));
        mvc.perform(get(ROOT + "/products/" + UUID.randomUUID()).header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/products?size=1&page=1").header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].name").value("Water"));
        mvc.perform(get(ROOT + "/products?search=PASTA").header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        for (String query : List.of("page=-1", "size=0", "size=101")) {
            mvc.perform(get(ROOT + "/products?" + query).header("Authorization", "Bearer demo-table-1"))
                    .andExpect(status().isBadRequest());
        }
    }

    /** Preserves successful simultaneous edits to an existing cart. */
    @Test
    void concurrentAddsToAnExistingDraftDoNotLoseItems() throws Exception {
        addPasta(1, 1).andExpect(status().isCreated());
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = java.util.stream.IntStream.range(0, 8).mapToObj(i ->
                    (java.util.concurrent.Callable<Integer>) () -> postItem(input(WATER, 1, "", "[]"))
                            .andReturn().getResponse().getStatus()).toList();
            for (var result : pool.invokeAll(tasks)) { assertThat(result.get()).isEqualTo(201); }
        }
        validateCart().andExpect(jsonPath("$.items.length()").value(9))
                .andExpect(jsonPath("$.total").value(39.60));
    }

    /** Creates one cart and retains only committed concurrent additions. */
    @Test
    void concurrentFirstAddsCreateOneCartAndCommitOnlySuccessfulItems() throws Exception {
        int successful = 0;
        try (var pool = Executors.newFixedThreadPool(4)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            var tasks = java.util.stream.IntStream.range(0, 4).mapToObj(i ->
                    pool.submit(() -> {
                        start.await();
                        return postItem(input(WATER, 1, "", "[]")).andReturn().getResponse().getStatus();
                    })).toList();
            start.countDown();
            for (var result : tasks) {
                int status = result.get();
                assertThat(status).isIn(201, 409);
                if (status == 201) { successful++; }
            }
        }
        assertThat(successful).isPositive();
        assertThat(drafts.count()).isEqualTo(1);
        validateCart().andExpect(jsonPath("$.items.length()").value(successful))
                .andExpect(jsonPath("$.total").value(new BigDecimal("3.20").multiply(BigDecimal.valueOf(successful)).doubleValue()));
    }

    /** Posts a selection using the first table’s credential. */
    private ResultActions postItem(String input) throws Exception {
        return mvc.perform(post(ROOT + "/current/items").header("Authorization", "Bearer demo-table-1")
                .contentType(MediaType.APPLICATION_JSON).content(input));
    }

    /** Adds the sample pasta with a note and extra. */
    private ResultActions addPasta(int quantity, int extraQuantity) throws Exception {
        return postItem(input(PASTA, quantity, "  No salt  ", extras(extraQuantity)));
    }

    /** Requests a fresh validation of the sample cart. */
    private ResultActions validateCart() throws Exception {
        return mvc.perform(post(ROOT + "/current/validate").header("Authorization", "Bearer demo-table-1"));
    }

    /** Builds an item request for HTTP validation tests. */
    private String input(UUID product, int quantity, String note, String extras) {
        return "{\"productId\":\"%s\",\"quantity\":%d,\"note\":\"%s\",\"extras\":%s}"
                .formatted(product, quantity, note, extras);
    }

    /** Builds a sample extra selection. */
    private String extras(int quantity) {
        return "[{\"extraId\":\"%s\",\"quantity\":%d}]".formatted(CHEESE, quantity);
    }
}
