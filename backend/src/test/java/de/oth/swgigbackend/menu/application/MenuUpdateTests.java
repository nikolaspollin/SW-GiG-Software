package de.oth.swgigbackend.menu.application;

import de.oth.swgigbackend.menu.api.MenuRequest;
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
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Integration Tests

@SpringBootTest
class MenuUpdateTests {
    @Autowired MenuService service;
    @Autowired MenuRepository menus;
    @Autowired PlatformTransactionManager transactions;

    @AfterEach
    void cleanUp() {
        menus.deleteAll();
    }

    // An active menu must not conflict with itself when updated
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void updatesActiveMenu(boolean fixed) {
        var menu = save(LifecycleStatus.ACTIVE, fixed);
        var request = new MenuRequest("Geändert", LifecycleStatus.ACTIVE, days(fixed), window(13, 16));

        var response = service.updateMenu(menu.getId(), request);

        assertThat(response.id()).isEqualTo(menu.getId());
        assertThat(response.name()).isEqualTo("Geändert");
        assertThat(response.servingTimeWindow()).isEqualTo(request.servingTimeWindow());

        var loaded = menus.findById(menu.getId()).orElseThrow();
        assertThat(loaded.getName()).isEqualTo("Geändert");
        assertThat(loaded.getServingTimeWindow()).isEqualTo(request.servingTimeWindow());
    }

    // Reject activation if an active menu overlaps and leave the stored draft unchanged
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsActivationOverlap(boolean fixed) {
        var draft = save(LifecycleStatus.DRAFT, fixed);
        save(LifecycleStatus.ACTIVE, fixed);

        var request = new MenuRequest("Geändert", LifecycleStatus.ACTIVE, days(fixed), window(13, 16));

        assertThatThrownBy(() -> service.updateMenu(draft.getId(), request))
                .isInstanceOf(ServingWindowOverlapException.class);

        var loaded = menus.findById(draft.getId()).orElseThrow();
        assertThat(loaded.getName()).isEqualTo("Original");
        assertThat(loaded.getLifecycleStatus()).isEqualTo(LifecycleStatus.DRAFT);
        assertThat(loaded.getServingTimeWindow()).isEqualTo(window(12, 17));
    }

    // Overlapping drafts and archived menus must not block activation
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void ignoresInactiveCandidates(boolean fixed) {
        var draft = save(LifecycleStatus.DRAFT, fixed);
        save(LifecycleStatus.DRAFT, fixed);
        save(LifecycleStatus.ARCHIVED, fixed);

        service.updateMenu(draft.getId(),
                new MenuRequest("Aktiviert", LifecycleStatus.ACTIVE, days(fixed), window(12, 17)));

        assertThat(menus.findById(draft.getId()).orElseThrow().getLifecycleStatus())
                .isEqualTo(LifecycleStatus.ACTIVE);
    }

    // Switching to a draft allows overlap and persists the change from weekdays to fixed dates
    @Test
    void updatesOverlappingDraft() {
        var menu = save(LifecycleStatus.ACTIVE, false);
        save(LifecycleStatus.ACTIVE, true);
        var request = new MenuRequest("Entwurf", LifecycleStatus.DRAFT, days(true), window(12, 17));

        service.updateMenu(menu.getId(), request);

        var loaded = menus.findById(menu.getId()).orElseThrow();
        assertThat(loaded.getLifecycleStatus()).isEqualTo(LifecycleStatus.DRAFT);
        assertThat(loaded.getServingDays()).isInstanceOfSatisfying(FixedDateServingDays.class,
                fixed -> assertThat(fixed.getFixedDates()).containsExactly(LocalDate.of(2026, 12, 24)));
    }

    // Updating must not be used to archive a menu
    @Test
    void rejectsArchivedTarget() {
        var menu = save(LifecycleStatus.ACTIVE, false);

        var request = new MenuRequest("Archiviert", LifecycleStatus.ARCHIVED, days(false), window(12, 17));

        assertThatThrownBy(() -> service.updateMenu(menu.getId(), request)).isInstanceOf(ArchivedMenuException.class);

        assertThat(menus.findById(menu.getId()).orElseThrow().getLifecycleStatus())
                .isEqualTo(LifecycleStatus.ACTIVE);
    }

    // Archived menus stay unchanged when targeting DRAFT or ACTIVE
    @ParameterizedTest
    @EnumSource(value = LifecycleStatus.class, names = {"DRAFT", "ACTIVE"})
    void rejectsArchivedMenuChanges(LifecycleStatus targetStatus) {
        var menu = save(LifecycleStatus.ARCHIVED, false);

        var request = new MenuRequest("Geändert", targetStatus, days(false), window(13, 16));

        assertThatThrownBy(() -> service.updateMenu(menu.getId(), request)).isInstanceOf(ArchivedMenuException.class);

        var loaded = menus.findById(menu.getId()).orElseThrow();
        assertThat(loaded.getLifecycleStatus()).isEqualTo(LifecycleStatus.ARCHIVED);
        assertThat(loaded.getName()).isEqualTo("Original");
        assertThat(loaded.getServingTimeWindow()).isEqualTo(window(12, 17));
    }

    @Test
    void rejectsMissingMenu() {
        var request = new MenuRequest("Fehlend", LifecycleStatus.DRAFT, days(false), window(12, 17));

        assertThatThrownBy(() -> service.updateMenu(UUID.randomUUID(), request))
                .isInstanceOf(MenuNotFoundException.class);
    }


    // Helper

    private Menu save(LifecycleStatus status, boolean fixed) {
        return menus.save(new Menu("Original", status, days(fixed), window(12, 17)));
    }

    private static ServingDays days(boolean fixed) {
        return fixed ? new FixedDateServingDays(Set.of(LocalDate.of(2026, 12, 24)))
                : new RegularServingDays(Set.of(DayOfWeek.MONDAY));
    }

    private static ServingTimeWindow window(int start, int end) {
        return new ServingTimeWindow(LocalTime.of(start, 0), LocalTime.of(end, 0));
    }
}
