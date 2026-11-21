package de.oth.swgigbackend.menu.application;

public class ServingWindowOverlapException extends RuntimeException {
    public ServingWindowOverlapException() {
        super("Menu serving time window overlaps an existing menu");
    }
}
