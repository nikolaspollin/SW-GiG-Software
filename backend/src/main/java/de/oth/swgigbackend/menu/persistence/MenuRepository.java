package de.oth.swgigbackend.menu.persistence;

import de.oth.swgigbackend.menu.domain.Menu;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MenuRepository extends JpaRepository<Menu, UUID> {

    // Only active menus are relevant for overlap detection
    // Treat is comparable to a cast => enables access to regularDays attribute
    @Query("SELECT DISTINCT m FROM Menu m JOIN TREAT(m.servingDays AS RegularServingDays).regularDays d WHERE m.lifecycleStatus = ACTIVE AND d IN :weekdays")
    List<Menu> findPossibleWeekdayOverlapMenus(@Param("weekdays") Collection<DayOfWeek> weekdays);

    @Query("SELECT DISTINCT m FROM Menu m JOIN TREAT(m.servingDays AS FixedDateServingDays).fixedDates d WHERE m.lifecycleStatus = ACTIVE AND d IN :dates")
    List<Menu> findPossibleFixedDateOverlapMenus(@Param("dates") Collection<LocalDate> dates);

}
