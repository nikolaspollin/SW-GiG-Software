package de.oth.swgigbackend.cart;

import java.util.UUID;

/** F03/T01 adapter must validate the credential, its table scope and the open session state. */
public interface GuestSessionAccess {
    /** Validates guest access and returns its open dining session. */
    UUID requireOpenSession(String bearerToken);
}
