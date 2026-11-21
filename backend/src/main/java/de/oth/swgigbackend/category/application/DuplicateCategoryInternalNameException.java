package de.oth.swgigbackend.category.application;

public class DuplicateCategoryInternalNameException extends RuntimeException {
    public DuplicateCategoryInternalNameException() {
        super("Category internal name already exists");
    }
}
