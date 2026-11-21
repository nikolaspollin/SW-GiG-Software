package de.oth.swgigbackend.menu.application;

import de.oth.swgigbackend.menu.api.MenuResponse;
import de.oth.swgigbackend.menu.domain.*;
import de.oth.swgigbackend.menu.persistence.MenuRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Integration Tests

@SpringBootTest
class MenuReadDeleteTests {
    @Autowired MenuService service;
    @Autowired MenuRepository menus;

    @AfterEach
    void cleanUp() {
        menus.deleteAll();
    }

    // Load both serving-day variants and check all response fields
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void getsMenu(boolean fixed) {
        var menu = save(fixed);

        var response = service.getMenu(menu.getId());

        assertResponse(response, menu);
    }

    @Test
    void rejectsMissingRead() {
        assertThatThrownBy(() -> service.getMenu(UUID.randomUUID()))
                .isInstanceOf(MenuNotFoundException.class);
    }

    @Test
    void getsEmptyList() {
        assertThat(service.getMenus()).isEmpty();
    }

    // Return both menus with their stored values, regardless of result order
    @Test
    void getsAllMenus() {
        var regular = save(false);
        var fixed = save(true);

        var responses = service.getMenus();

        assertThat(responses).satisfiesExactlyInAnyOrder(
                response -> assertResponse(response, regular),
                response -> assertResponse(response, fixed));
    }

    // Deleting must commit the archived status while keeping the menu in the database
    @Test
    void archivesMenu() {
        var menu = save(false);

        service.deleteMenu(menu.getId());

        var loaded = menus.findById(menu.getId()).orElseThrow();
        assertThat(loaded.getLifecycleStatus()).isEqualTo(LifecycleStatus.ARCHIVED);
    }

    @Test
    void rejectsMissingDelete() {
        assertThatThrownBy(() -> service.deleteMenu(UUID.randomUUID()))
                .isInstanceOf(MenuNotFoundException.class);
    }

    // Helper

    private Menu save(boolean fixed) {
        ServingDays days = fixed
                ? new FixedDateServingDays(Set.of(LocalDate.of(2026, 12, 24)))
                : new RegularServingDays(Set.of(DayOfWeek.MONDAY));

        return menus.save(new Menu(fixed ? "Festtagskarte" : "Wochenkarte", LifecycleStatus.ACTIVE,
                days, new ServingTimeWindow(LocalTime.of(12, 0), LocalTime.of(17, 0))));
    }

    private void assertResponse(MenuResponse response, Menu expected) {
        assertThat(response.id()).isEqualTo(expected.getId());
        assertThat(response.name()).isEqualTo(expected.getName());
        assertThat(response.lifecycleStatus()).isEqualTo(expected.getLifecycleStatus());
        assertThat(response.servingTimeWindow()).isEqualTo(expected.getServingTimeWindow());
        assertThat(response.servingDays()).isExactlyInstanceOf(expected.getServingDays().getClass());
        assertThat(response.servingDays()).usingRecursiveComparison().isEqualTo(expected.getServingDays());
    }
}
