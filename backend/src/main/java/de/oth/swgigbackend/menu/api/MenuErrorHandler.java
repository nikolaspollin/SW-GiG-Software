package de.oth.swgigbackend.menu.api;

import de.oth.swgigbackend.menu.application.ArchivedMenuException;
import de.oth.swgigbackend.menu.application.InvalidServingDaysException;
import de.oth.swgigbackend.menu.application.MenuNotFoundException;
import de.oth.swgigbackend.menu.application.ServingWindowOverlapException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = MenuController.class)
public class MenuErrorHandler {

    @ExceptionHandler(ServingWindowOverlapException.class)
    public ProblemDetail handleServingWindowOverlap(ServingWindowOverlapException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(MenuNotFoundException.class)
    public ProblemDetail handleMenuNotFound(MenuNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(ArchivedMenuException.class)
    public ProblemDetail handleArchivedMenu(ArchivedMenuException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(InvalidServingDaysException.class)
    public ProblemDetail handleInvalidServingDays(InvalidServingDaysException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
    }
}
