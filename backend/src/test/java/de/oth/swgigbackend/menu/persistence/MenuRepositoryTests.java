package de.oth.swgigbackend.menu.persistence;

import de.oth.swgigbackend.menu.domain.*;
import jakarta.persistence.EntityManager;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

// Tests menu persistence, repository queries and JSON subtype detection

@SpringBootTest
@Transactional
class MenuRepositoryTests {
    @Autowired MenuRepository menus;
    @Autowired EntityManager entityManager;
    @Autowired JsonMapper json;

    @Test
    void persistsRegularServingDaysAndTimeWindow() {
        assertRoundTrip(new RegularServingDays(Set.of(DayOfWeek.MONDAY, DayOfWeek.FRIDAY)));
    }

    @Test
    void persistsFixedDateServingDaysAndTimeWindow() {
        assertRoundTrip(new FixedDateServingDays(Set.of(LocalDate.of(2026, 12, 24))));
    }

    // Switch serving-day variants in both directions and check that old entries are removed
    @Test
    void switchesVariantsAndRemovesPreviousDays() {
        var window = new ServingTimeWindow(LocalTime.of(8, 0), LocalTime.of(12, 0));
        var menu = menus.saveAndFlush(new Menu("Frühstück", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(DayOfWeek.MONDAY, DayOfWeek.FRIDAY)), window));

        var id = menu.getId();
        entityManager.clear();

        menu = menus.findById(id).orElseThrow();
        // Switch from weekdays to fixed dates
        menu.setServingDays(new FixedDateServingDays(Set.of(LocalDate.of(2026, 12, 24))));
        menus.flush();
        entityManager.clear();

        menu = menus.findById(id).orElseThrow();
        assertThat(menu.getServingDays()).isInstanceOfSatisfying(FixedDateServingDays.class,
                fixed -> assertThat(fixed.getFixedDates()).containsExactly(LocalDate.of(2026, 12, 24)));
        // No previous weekday entries should remain for this menu
        assertThat(((Number) entityManager.createNativeQuery(
                "select count(*) from menu_weekdays where menu_id = :id")
                .setParameter("id", id).getSingleResult()).longValue()).isZero();

        // Switch back to weekdays
        menu.setServingDays(new RegularServingDays(Set.of(DayOfWeek.SUNDAY)));
        menus.flush();
        entityManager.clear();

        menu = menus.findById(id).orElseThrow();
        assertThat(menu.getServingDays()).isInstanceOfSatisfying(RegularServingDays.class,
                regular -> assertThat(regular.getRegularDays()).containsExactly(DayOfWeek.SUNDAY));
        // No previous fixed-date entries should remain for this menu
        assertThat(((Number) entityManager.createNativeQuery(
                "select count(*) from menu_fixed_dates where menu_id = :id")
                .setParameter("id", id).getSingleResult()).longValue()).isZero();
    }

    // Infer the serving-day subtype from its JSON fields without an explicit type field
    @Test
    void stillDeducesBothVariantsFromJson() {
        var regular = json.readValue("""
                {"regularDays": ["MONDAY", "FRIDAY"]}
                """, ServingDays.class);
        assertThat(regular).isInstanceOfSatisfying(RegularServingDays.class,
                days -> assertThat(days.getRegularDays()).containsExactlyInAnyOrder(DayOfWeek.MONDAY, DayOfWeek.FRIDAY));

        var fixed = json.readValue("""
                {"fixedDates": ["2026-12-24"]}
                """, ServingDays.class);
        assertThat(fixed).isInstanceOfSatisfying(FixedDateServingDays.class,
                days -> assertThat(days.getFixedDates()).containsExactly(LocalDate.of(2026, 12, 24)));
    }

    // Find only matching fixed-date menus without returning duplicates
    @Test
    void findsOnlyMatchingFixedDateMenusWithoutDuplicates() {
        var date = LocalDate.of(2026, 12, 24);
        var window = new ServingTimeWindow(LocalTime.of(18, 0), LocalTime.of(2, 0));

        // Both dates match, but the menu should only appear once
        var matching = menus.save(new Menu("Festtagskarte", LifecycleStatus.ACTIVE,
                new FixedDateServingDays(Set.of(date, date.plusDays(1))), window));

        // Unrelated dates and weekday menus must not match
        menus.save(new Menu("Andere Festtagskarte", LifecycleStatus.ACTIVE,
                new FixedDateServingDays(Set.of(date.plusDays(7))), window));
        menus.save(new Menu("Reguläre Karte", LifecycleStatus.ACTIVE,
                new RegularServingDays(Set.of(date.getDayOfWeek())), window));

        menus.flush();
        entityManager.clear();

        var candidates = menus.findPossibleFixedDateOverlapMenus(Set.of(date, date.plusDays(1)));

        assertThat(candidates).extracting(Menu::getId).containsExactly(matching.getId());
        assertThat(((FixedDateServingDays) candidates.getFirst().getServingDays()).getFixedDates())
                .containsExactlyInAnyOrder(date, date.plusDays(1));
    }

    // Save and reload a menu, checking that all attributes are preserved
    private void assertRoundTrip(ServingDays servingDays) {
        var window = new ServingTimeWindow(LocalTime.of(18, 0), LocalTime.of(2, 0));
        var saved = menus.saveAndFlush(new Menu("Abendkarte", LifecycleStatus.DRAFT, servingDays, window));

        var id = saved.getId();
        assertThat(id).isNotNull();
        // Reload from the database instead of reusing the managed entity
        entityManager.clear();

        var loaded = menus.findById(id).orElseThrow();
        // Serving days must remain readable after detaching the menu
        entityManager.clear();

        assertThat(loaded.getName()).isEqualTo("Abendkarte");
        assertThat(loaded.getLifecycleStatus()).isEqualTo(LifecycleStatus.DRAFT);
        assertThat(loaded.getServingDays()).isExactlyInstanceOf(servingDays.getClass());

        switch (servingDays) {
            case RegularServingDays regular -> assertThat(((RegularServingDays) loaded.getServingDays()).getRegularDays())
                    .containsExactlyInAnyOrderElementsOf(regular.getRegularDays());

            case FixedDateServingDays fixed -> assertThat(((FixedDateServingDays) loaded.getServingDays()).getFixedDates())
                    .containsExactlyInAnyOrderElementsOf(fixed.getFixedDates());

            default -> throw new AssertionError("Unexpected serving days type");
        }

        assertThat(loaded.getServingTimeWindow()).isEqualTo(window);
    }
}
