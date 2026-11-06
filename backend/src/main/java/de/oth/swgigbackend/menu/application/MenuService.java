package de.oth.swgigbackend.menu.application;

import de.oth.swgigbackend.menu.api.MenuRequest;
import de.oth.swgigbackend.menu.api.MenuResponse;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import de.oth.swgigbackend.menu.domain.*;
import de.oth.swgigbackend.menu.persistence.MenuRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MenuService {

    private final MenuRepository menuRepository;

    public MenuService(MenuRepository menuRepository) {
        this.menuRepository = menuRepository;
    }

    public List<MenuResponse> getMenus() {

        // Get all menus from database, map them to DTOs and return to the controller
        return menuRepository.findAll()
                .stream().map((MenuResponse::from))
                .toList();
    }

    public MenuResponse getMenu(UUID menuId) {

        return menuRepository.findById(menuId)
                .map(MenuResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Desired menu not found"));
    }

    @Transactional
    public MenuResponse createMenu(MenuRequest request) {
        validateMenu(request, null);

        Menu menu = new Menu(
                request.name(),
                request.lifecycleStatus(),
                request.servingDays(),
                request.servingTimeWindow()
        );

        return MenuResponse.from(menuRepository.save(menu));
    }

    // A null excludedMenuId means creation; updates exclude their own persisted menu.
    private void validateMenu(MenuRequest request, UUID excludedMenuId) {
        if (request.lifecycleStatus() == LifecycleStatus.ARCHIVED)
            throw new IllegalArgumentException("Menu cannot be created or updated in archived state");

        // Checks only consider active menus (no drafts / archived menus)
        if (request.lifecycleStatus() == LifecycleStatus.ACTIVE) {
            // Check week day serving window overlapping with existing menus
            if (request.servingDays() instanceof RegularServingDays regular) {
                Set<DayOfWeek> overlapCandidates = EnumSet.copyOf(regular.getRegularDays());

                // Duplicates are negligible because of EnumSet
                for (DayOfWeek day : regular.getRegularDays()) {
                    // Menu of previous day could last until after midnight
                    overlapCandidates.add(day.minus(1));

                    // New Menu could last until after midnight and create a conflict then
                    if (!request.servingTimeWindow().endTime().isAfter(request.servingTimeWindow().startTime()))
                        overlapCandidates.add(day.plus(1));
                }

                // For update case: filter own menu from database results
                List<Menu> candidates = menuRepository.findPossibleWeekdayOverlapMenus(overlapCandidates)
                        .stream()
                        .filter(menu -> excludedMenuId == null || !excludedMenuId.equals(menu.getId()))
                        .toList();

                // Actual time window check
                if (hasRegularTimeWindowOverlap(candidates, request.servingTimeWindow(), regular.getRegularDays()))
                    throw new IllegalArgumentException("Menu serving time window overlaps an existing menu");
            } // Check fixed date windows as well
            // Fixed Date Menus are allowed to overlap weekday menus, therefore, weekday menus can be ignored
            else if (request.servingDays() instanceof FixedDateServingDays fixed) {
                Set<LocalDate> overlapCandidates = new HashSet<>(fixed.getFixedDates());

                for (LocalDate date : fixed.getFixedDates()) {
                    overlapCandidates.add(date.minusDays(1));

                    if (!request.servingTimeWindow().endTime().isAfter(request.servingTimeWindow().startTime()))
                        overlapCandidates.add(date.plusDays(1));
                }

                // For update case: filter own menu from database results
                List<Menu> candidates = menuRepository.findPossibleFixedDateOverlapMenus(overlapCandidates)
                        .stream()
                        .filter(menu -> excludedMenuId == null || !excludedMenuId.equals(menu.getId()))
                        .toList();

                if (hasFixedDateTimeWindowOverlap(candidates, request.servingTimeWindow(), fixed.getFixedDates()))
                    throw new IllegalArgumentException("Menu serving time window overlaps an existing menu");
            } else
                throw new IllegalStateException("Inconsistent menu state (serving days)");
        }
    }

    /** Compares regular menus using [start, end) windows and their relative start days. */
    boolean hasRegularTimeWindowOverlap(List<Menu> existingMenus, ServingTimeWindow requestedWindow,
                                        Set<DayOfWeek> requestedDays) {
        long day = Duration.ofDays(1).toNanos();

        // Convert to number values for convenient comparison
        long start = requestedWindow.startTime().toNanoOfDay();
        long end = requestedWindow.endTime().toNanoOfDay();
        if (end <= start) end += day;

        // For each candidate menu every day of the new menu needs to be checked
        // Previous and following days have to be checked as well, since menus can overlap over multiple days
        for (Menu menu : existingMenus) {
            if (!(menu.getServingDays() instanceof RegularServingDays regular)) continue;

            long existingStart = menu.getServingTimeWindow().startTime().toNanoOfDay();
            long existingEnd = menu.getServingTimeWindow().endTime().toNanoOfDay();
            if (existingEnd <= existingStart) existingEnd += day;

            for (DayOfWeek requestedDay : requestedDays) {
                // Check every matching relation: one menu can apply on several of these days
                // Fixed loop for code convenience
                for (int dayOffset = -1; dayOffset <= 1; dayOffset++) {
                    if (!regular.getRegularDays().contains(requestedDay.plus(dayOffset))) continue;

                    long offset = dayOffset * day;
                    if (start < existingEnd + offset && existingStart + offset < end) return true;
                }
            }
        }

        return false;
    }

    /** Compares fixed-date menus using [start, end) windows on their actual dates. */
    boolean hasFixedDateTimeWindowOverlap(List<Menu> existingMenus, ServingTimeWindow requestedWindow,
                                          Set<LocalDate> requestedDates) {
        // For each candidate menu every date of the new menu needs to be checked
        for (Menu menu : existingMenus) {
            if (!(menu.getServingDays() instanceof FixedDateServingDays fixed)) continue;
            ServingTimeWindow existingWindow = menu.getServingTimeWindow();

            for (LocalDate requestedDate : requestedDates) {
                // Combine date and time so comparisons include the actual day
                LocalDateTime start = requestedDate.atTime(requestedWindow.startTime());
                LocalDateTime end = requestedDate.atTime(requestedWindow.endTime());
                // Earlier or equal end time means the window ends on the following day
                if (!end.isAfter(start)) end = end.plusDays(1);

                // Check the previous, same and following date: windows last at most 24 hours
                // Check every matching date, since one menu can apply on several of them
                for (int dayOffset = -1; dayOffset <= 1; dayOffset++) {
                    LocalDate existingDate = requestedDate.plusDays(dayOffset);
                    if (!fixed.getFixedDates().contains(existingDate)) continue;

                    // Build the candidate window on its actual start date, including a possible midnight crossing
                    LocalDateTime existingStart = existingDate.atTime(existingWindow.startTime());
                    LocalDateTime existingEnd = existingDate.atTime(existingWindow.endTime());
                    if (!existingEnd.isAfter(existingStart)) existingEnd = existingEnd.plusDays(1);

                    if (start.isBefore(existingEnd) && existingStart.isBefore(end)) return true;
                }
            }
        }

        return false;
    }

    @Transactional
    public MenuResponse updateMenu(UUID menuId, MenuRequest request) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new EntityNotFoundException("Menu not found"));

        // Validate before changing the managed entity, so queries see its previous state.
        validateMenu(request, menuId);

        menu.setName(request.name());
        menu.setLifecycleStatus(request.lifecycleStatus());
        menu.setServingDays(request.servingDays());
        menu.setServingTimeWindow(request.servingTimeWindow());

        // Hibernate persists the changes when the transaction commits.
        return MenuResponse.from(menu);
    }

    @Transactional
    public void deleteMenu(UUID menuId) {
        //TODO MenuCategory need to be considered later as well

        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new EntityNotFoundException("Menu not found"));

        menu.setLifecycleStatus(LifecycleStatus.ARCHIVED);
    }
}
