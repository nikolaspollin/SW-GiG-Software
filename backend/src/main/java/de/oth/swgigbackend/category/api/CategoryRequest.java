package de.oth.swgigbackend.category.api;

import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CategoryRequest(@NotBlank @Size(max = 255) String displayName,
                              @NotBlank @Size(max = 255) String internalName,
                              @NotNull LifecycleStatus lifecycleStatus) {
}
