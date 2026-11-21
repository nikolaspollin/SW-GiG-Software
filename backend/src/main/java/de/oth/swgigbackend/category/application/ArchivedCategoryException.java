package de.oth.swgigbackend.category.application;

public class ArchivedCategoryException extends RuntimeException {
    public ArchivedCategoryException() {
        super("Category cannot be created or updated in archived state");
    }
}
