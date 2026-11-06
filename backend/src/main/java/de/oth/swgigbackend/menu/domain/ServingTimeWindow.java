package de.oth.swgigbackend.menu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

@Embeddable
// endTime <= startTime means the window ends on the following day (equal times mean 24 hours).
public record ServingTimeWindow(@NotNull @Column(nullable = false) LocalTime startTime,
                                @NotNull @Column(nullable = false) LocalTime endTime) {}
