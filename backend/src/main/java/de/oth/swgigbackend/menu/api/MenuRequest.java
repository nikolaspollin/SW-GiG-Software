package de.oth.swgigbackend.menu.api;

import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import de.oth.swgigbackend.menu.domain.ServingDays;
import de.oth.swgigbackend.menu.domain.ServingTimeWindow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

//TODO Include menu category (?)

public record MenuRequest(@NotBlank String name,
                          @NotNull LifecycleStatus lifecycleStatus,
                          @NotNull @Valid ServingDays servingDays,
                          @NotNull @Valid ServingTimeWindow servingTimeWindow) {
}
