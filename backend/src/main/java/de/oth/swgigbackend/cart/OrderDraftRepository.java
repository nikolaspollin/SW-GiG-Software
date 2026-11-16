package de.oth.swgigbackend.cart;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Loads carts and locks them for serialized edits. */
interface OrderDraftRepository extends JpaRepository<OrderDraft, UUID> {
    /** Finds the cart belonging to a dining session. */
    Optional<OrderDraft> findBySessionId(UUID sessionId);

    /** Locks the session’s cart until its transaction finishes. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from OrderDraft d where d.sessionId = :sessionId")
    Optional<OrderDraft> lockBySessionId(@Param("sessionId") UUID sessionId);
}
