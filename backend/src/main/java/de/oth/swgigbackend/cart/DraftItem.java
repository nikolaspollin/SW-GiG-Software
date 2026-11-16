package de.oth.swgigbackend.cart;

import jakarta.persistence.*;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** A cart’s product selection, quantities and note. */
@Entity
@Table(name = "order_draft_items")
class DraftItem {
    @Id
    UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "draft_id", nullable = false)
    OrderDraft draft;
    @Column(nullable = false, updatable = false)
    UUID productId;
    @Column(nullable = false)
    int quantity;
    @Column(nullable = false, length = 500)
    String note;
    @ElementCollection
    @CollectionTable(name = "order_draft_item_extras", joinColumns = @JoinColumn(name = "item_id"))
    @MapKeyColumn(name = "extra_id")
    @Column(name = "quantity", nullable = false)
    Map<UUID, Integer> extras = new HashMap<>();

    /** Required by JPA. */
    protected DraftItem() {}

    /** Creates an item linked to its cart and product. */
    DraftItem(OrderDraft draft, UUID productId) {
        this.id = UUID.randomUUID();
        this.draft = draft;
        this.productId = productId;
    }

    /** Replaces the selection after server validation. */
    void update(CartDtos.ItemInput input) {
        quantity = input.quantity();
        note = input.note() == null ? "" : input.note().strip();
        extras.clear();
        input.extras().forEach(extra -> extras.put(extra.extraId(), extra.quantity()));
    }
}
