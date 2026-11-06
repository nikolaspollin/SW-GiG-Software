package de.oth.swgigbackend.menu.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Embeddable
@DiscriminatorValue("FIXED")
public class FixedDateServingDays extends ServingDays {
    @NotEmpty
    @ElementCollection
    @CollectionTable(name = "menu_fixed_dates", joinColumns = @JoinColumn(name = "menu_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = {"menu_id", "serving_date"}))
    @Column(name = "serving_date", nullable = false)
    private Set<@NotNull LocalDate> fixedDates;

    protected FixedDateServingDays() {
        super("FIXED");
    }

    public FixedDateServingDays(Set<LocalDate> fixedDates) {
        this();
        setFixedDates(fixedDates);
    }

    public Set<LocalDate> getFixedDates() {
        return fixedDates;
    }

    public void setFixedDates(Set<LocalDate> fixedDates) {
        this.fixedDates = fixedDates == null ? null : new HashSet<>(fixedDates);
    }
}
