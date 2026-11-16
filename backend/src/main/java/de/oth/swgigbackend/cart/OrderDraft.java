package de.oth.swgigbackend.cart;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** A persisted cart owned by one dining session. */
@Entity
@Table(name = "order_drafts", uniqueConstraints = @UniqueConstraint(columnNames = "session_id"))
class OrderDraft {
    @Id
    UUID id;
    @Column(name = "session_id", nullable = false, updatable = false)
    UUID sessionId;
    @Version
    long version;
    @OneToMany(mappedBy = "draft", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    List<DraftItem> items = new ArrayList<>();

    /** Required by JPA. */
    protected OrderDraft() {}

    /** Starts an empty cart for the session. */
    OrderDraft(UUID sessionId) {
        this.id = UUID.randomUUID();
        this.sessionId = sessionId;
    }
}
