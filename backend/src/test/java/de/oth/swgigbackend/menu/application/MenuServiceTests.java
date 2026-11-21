package de.oth.swgigbackend.menu.application;

import de.oth.swgigbackend.menu.api.MenuRequest;
import de.oth.swgigbackend.menu.domain.FixedDateServingDays;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import de.oth.swgigbackend.menu.domain.Menu;
import de.oth.swgigbackend.menu.domain.RegularServingDays;
import de.oth.swgigbackend.menu.domain.ServingTimeWindow;
import de.oth.swgigbackend.menu.persistence.MenuRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Service Unit Tests

class MenuServiceTests {
    private final MenuRepository repository = mock(MenuRepository.class);
    private final MenuService service = new MenuService(repository);

    // Compare windows with the same start day, including midnight crossings and 24-hour windows
    @ParameterizedTest
    @CsvSource({
            "12:00, 14:00, 15:00, 17:00, false",
            "15:00, 17:00, 12:00, 14:00, false",
            "12:00, 17:00, 17:00, 22:00, false",
            "17:00, 22:00, 12:00, 17:00, false",
            "12:00, 17:00, 16:00, 22:00, true",
            "16:00, 22:00, 12:00, 17:00, true",
            "12:00, 22:00, 14:00, 16:00, true",
            "14:00, 16:00, 12:00, 22:00, true",
            "12:00, 17:00, 12:00, 17:00, true",
            "22:00, 02:00, 23:00, 03:00, true",
            "22:00, 02:00, 20:00, 23:00, true",
            "20:00, 23:00, 22:00, 02:00, true",
            "22:00, 02:00, 02:00, 04:00, false",
            "20:00, 22:00, 22:00, 02:00, false",
            "00:00, 00:00, 12:00, 13:00, true",
            "12:00, 13:00, 00:00, 00:00, true",
            "12:00, 12:00, 08:00, 10:00, false"
    })
    void comparesSameDayWindows(String start, String end,
                                String existingStart, String existingEnd, boolean overlaps) {
        var menu = menu(window(existingStart, existingEnd));
        assertThat(service.hasRegularTimeWindowOverlap(List.of(menu), window(start, end), Set.of(DayOfWeek.MONDAY)))
                .isEqualTo(overlaps);
    }

    @Test
    void emptyCandidatesDoNotOverlap() {
        assertThat(service.hasRegularTimeWindowOverlap(List.of(), window("12:00", "17:00"), Set.of(DayOfWeek.MONDAY)))
                .isFalse();
    }

    // Keep checking candidates after the first one has no overlap
    @Test
    void checksLaterCandidates() {
        var candidates = List.of(menu(window("08:00", "10:00")), menu(window("16:00", "22:00")));
        assertThat(service.hasRegularTimeWindowOverlap(candidates, window("12:00", "17:00"), Set.of(DayOfWeek.MONDAY)))
                .isTrue();
    }

    // Creating an active weekday menu must fail when an existing candidate overlaps
    @Test
    void rejectsRegularOverlap() {
        var days = new RegularServingDays(Set.of(DayOfWeek.MONDAY));
        var request = new MenuRequest("Mittagskarte", LifecycleStatus.ACTIVE, days, window("12:00", "17:00"));

        when(repository.findPossibleWeekdayOverlapMenus(Set.of(DayOfWeek.SUNDAY, DayOfWeek.MONDAY)))
                .thenReturn(List.of(menu(window("16:00", "22:00"))));

        assertThatExceptionOfType(ServingWindowOverlapException.class).isThrownBy(() -> service.createMenu(request))
                .withMessage("Menu serving time window overlaps an existing menu");
    }

    // Account for weekday offsets, including midnight crossings and Sunday to Monday
    @ParameterizedTest
    @CsvSource({
            "TUESDAY, 16:00, 23:00, MONDAY, 15:00, 03:00, false",
            "TUESDAY, 01:00, 03:00, MONDAY, 15:00, 03:00, true",
            "TUESDAY, 03:00, 04:00, MONDAY, 15:00, 03:00, false",
            "MONDAY, 22:00, 03:00, TUESDAY, 01:00, 04:00, true",
            "MONDAY, 22:00, 03:00, TUESDAY, 03:00, 04:00, false",
            "FRIDAY, 22:00, 02:00, SATURDAY, 01:00, 03:00, true",
            "SUNDAY, 22:00, 02:00, MONDAY, 01:00, 03:00, true",
            "MONDAY, 01:00, 03:00, SUNDAY, 22:00, 02:00, true",
            "WEDNESDAY, 12:00, 13:00, MONDAY, 12:00, 13:00, false",
            "TUESDAY, 01:00, 03:00, MONDAY, 12:00, 12:00, true",
            "TUESDAY, 12:00, 12:00, WEDNESDAY, 01:00, 02:00, true"
    })
    void comparesWeekdayWindows(DayOfWeek requestedDay, String start, String end,
                                DayOfWeek existingDay, String existingStart,
                                String existingEnd, boolean overlaps) {
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(existingDay)), window(existingStart, existingEnd));

        assertThat(service.hasRegularTimeWindowOverlap(List.of(candidate), window(start, end), Set.of(requestedDay)))
                .isEqualTo(overlaps);
    }

    // A candidate valid on the previous day must still be checked for the requested day
    @Test
    void checksSameDayOverlap() {
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY)), window("19:00", "21:00"));

        assertThat(service.hasRegularTimeWindowOverlap(List.of(candidate), window("20:00", "22:00"),
                Set.of(DayOfWeek.TUESDAY))).isTrue();
    }

    // Check every requested and candidate weekday, including overlaps into the next day
    @Test
    void checksAllWeekdays() {
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(DayOfWeek.TUESDAY, DayOfWeek.SATURDAY)), window("01:00", "03:00"));

        assertThat(service.hasRegularTimeWindowOverlap(List.of(candidate), window("22:00", "02:00"),
                Set.of(DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))).isTrue();
    }

    // A 24-hour window starting at noon must search the following day too
    @Test
    void searchesFullDayNeighbours() {
        var days = new RegularServingDays(Set.of(DayOfWeek.MONDAY));
        var request = new MenuRequest("Tageskarte", LifecycleStatus.ACTIVE, days, window("12:00", "12:00"));

        var expectedDays = Set.of(DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY);
        var candidate = new Menu("Dienstagskarte", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(DayOfWeek.TUESDAY)), window("08:00", "10:00"));

        when(repository.findPossibleWeekdayOverlapMenus(expectedDays)).thenReturn(List.of(candidate));

        assertThatExceptionOfType(ServingWindowOverlapException.class).isThrownBy(() -> service.createMenu(request));
        verify(repository).findPossibleWeekdayOverlapMenus(expectedDays);
    }

    // Compare actual dates across midnight, year changes and leap days
    @ParameterizedTest
    @CsvSource({
            "2026-12-24, 12:00, 17:00, 2026-12-24, 16:00, 22:00, true",
            "2026-12-24, 12:00, 17:00, 2026-12-24, 17:00, 22:00, false",
            "2026-12-24, 16:00, 23:00, 2026-12-23, 15:00, 03:00, false",
            "2026-12-24, 01:00, 03:00, 2026-12-23, 15:00, 03:00, true",
            "2026-12-24, 03:00, 04:00, 2026-12-23, 15:00, 03:00, false",
            "2026-12-24, 22:00, 03:00, 2026-12-25, 01:00, 04:00, true",
            "2026-12-24, 22:00, 03:00, 2026-12-25, 03:00, 04:00, false",
            "2026-12-31, 22:00, 02:00, 2027-01-01, 01:00, 03:00, true",
            "2028-03-01, 01:00, 03:00, 2028-02-29, 22:00, 02:00, true",
            "2026-12-24, 12:00, 12:00, 2026-12-25, 08:00, 10:00, true",
            "2026-12-24, 01:00, 03:00, 2026-12-23, 12:00, 12:00, true",
            "2026-12-24, 12:00, 17:00, 2026-12-31, 12:00, 17:00, false"
    })
    void comparesDateWindows(LocalDate requestedDate, String start, String end,
                             LocalDate existingDate, String existingStart,
                             String existingEnd, boolean overlaps) {
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new FixedDateServingDays(Set.of(existingDate)), window(existingStart, existingEnd));

        assertThat(service.hasFixedDateTimeWindowOverlap(List.of(candidate), window(start, end),
                Set.of(requestedDate))).isEqualTo(overlaps);
    }

    // Check all date combinations, even when the first dates do not match
    @Test
    void checksAllDates() {
        var date = LocalDate.of(2026, 12, 24);
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new FixedDateServingDays(Set.of(date.minusDays(1), date)), window("19:00", "21:00"));

        assertThat(service.hasFixedDateTimeWindowOverlap(List.of(candidate), window("20:00", "22:00"),
                Set.of(date.minusDays(7), date))).isTrue();
        assertThat(service.hasFixedDateTimeWindowOverlap(List.of(), window("20:00", "22:00"),
                Set.of(date))).isFalse();
        assertThat(service.hasFixedDateTimeWindowOverlap(List.of(candidate), window("20:00", "22:00"),
                Set.of(date.minusDays(7)))).isFalse();
    }

    // Search requested dates and their neighbours together, then reject the overlap
    @Test
    void rejectsFixedDateOverlap() {
        var date = LocalDate.of(2026, 12, 24);
        var days = new FixedDateServingDays(Set.of(date, date.plusDays(1)));
        var request = new MenuRequest("Festtagskarte", LifecycleStatus.ACTIVE, days, window("22:00", "02:00"));

        var expectedDates = Set.of(date.minusDays(1), date, date.plusDays(1), date.plusDays(2));
        var candidate = new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new FixedDateServingDays(Set.of(date.plusDays(2))), window("01:00", "03:00"));

        when(repository.findPossibleFixedDateOverlapMenus(expectedDates)).thenReturn(List.of(candidate));

        assertThatExceptionOfType(ServingWindowOverlapException.class).isThrownBy(() -> service.createMenu(request))
                .withMessage("Menu serving time window overlaps an existing menu");
        verify(repository).findPossibleFixedDateOverlapMenus(expectedDates);
        // Searching neighbouring dates must not change the request
        assertThat(days.getFixedDates()).containsExactlyInAnyOrder(date, date.plusDays(1));
    }


    // Helper

    private static ServingTimeWindow window(String start, String end) {
        return new ServingTimeWindow(LocalTime.parse(start), LocalTime.parse(end));
    }

    private static Menu menu(ServingTimeWindow window) {
        return new Menu("Bestehendes Menü", LifecycleStatus.DRAFT,
                new RegularServingDays(Set.of(DayOfWeek.MONDAY)), window);
    }
}
