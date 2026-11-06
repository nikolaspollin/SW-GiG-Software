package de.oth.swgigbackend.menu.api;

import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import de.oth.swgigbackend.menu.domain.Menu;
import de.oth.swgigbackend.menu.domain.ServingDays;
import de.oth.swgigbackend.menu.domain.ServingTimeWindow;
import java.util.UUID;

public record MenuResponse(UUID id, String name, LifecycleStatus lifecycleStatus,
                           ServingDays servingDays, ServingTimeWindow servingTimeWindow) {
    public static MenuResponse from(Menu menu) {
        return new MenuResponse(menu.getId(), menu.getName(), menu.getLifecycleStatus(),
                menu.getServingDays(), menu.getServingTimeWindow());
    }
}
