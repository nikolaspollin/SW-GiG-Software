package de.oth.swgigbackend.category.api;

import de.oth.swgigbackend.category.application.ArchivedCategoryException;
import de.oth.swgigbackend.category.application.CategoryNotFoundException;
import de.oth.swgigbackend.category.application.DuplicateCategoryInternalNameException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = CategoryController.class)
public class CategoryErrorHandler {
    @ExceptionHandler(CategoryNotFoundException.class)
    public ProblemDetail handleNotFound(CategoryNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler({ArchivedCategoryException.class, DuplicateCategoryInternalNameException.class})
    public ProblemDetail handleConflict(RuntimeException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    // The database still enforces uniqueness if concurrent requests pass the service check.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataConflict(DataIntegrityViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Category data conflicts with existing categories");
    }
}
