package de.oth.swgigbackend.category.api;

import de.oth.swgigbackend.category.domain.Category;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;

import java.util.UUID;

public record CategoryResponse(UUID id, String displayName, String internalName,
                               LifecycleStatus lifecycleStatus) {
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getDisplayName(),
                category.getInternalName(),
                category.getLifecycleStatus());
    }
}
