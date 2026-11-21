package de.oth.swgigbackend.menu.application;

public class InvalidServingDaysException extends RuntimeException {
    public InvalidServingDaysException() {
        super("Inconsistent menu state (serving days)");
    }
}
