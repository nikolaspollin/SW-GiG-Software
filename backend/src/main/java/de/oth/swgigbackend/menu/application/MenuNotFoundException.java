package de.oth.swgigbackend.menu.application;

public class MenuNotFoundException extends RuntimeException {
    public MenuNotFoundException() {
        super("Menu not found");
    }
}
