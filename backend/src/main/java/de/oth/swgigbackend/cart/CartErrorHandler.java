package de.oth.swgigbackend.cart;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

/** Returns concise Problem Details for cart failures. */
@RestControllerAdvice(assignableTypes = CartController.class)
class CartErrorHandler {
    /** Preserves each business error's status and explanation. */
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ProblemDetail> cart(ResponseStatusException error) {
        return problem(error.getStatusCode(), error.getReason());
    }

    /** Reports malformed input without exposing internal details. */
    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class,
            HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            HandlerMethodValidationException.class})
    ResponseEntity<ProblemDetail> validation(Exception error) {
        return problem(HttpStatus.BAD_REQUEST, "Check quantities (1–99), product/extra IDs and note length (max. 500).");
    }

    /** Asks guests to refresh after conflicting writes. */
    @ExceptionHandler({DataIntegrityViolationException.class, PessimisticLockingFailureException.class})
    ResponseEntity<ProblemDetail> conflict(Exception error) {
        return problem(HttpStatus.CONFLICT, "The cart changed concurrently. Reload it before retrying.");
    }

    /** Builds an uncached error response. */
    private ResponseEntity<ProblemDetail> problem(HttpStatusCode status, String detail) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(ProblemDetail.forStatusAndDetail(status, detail));
    }
}
