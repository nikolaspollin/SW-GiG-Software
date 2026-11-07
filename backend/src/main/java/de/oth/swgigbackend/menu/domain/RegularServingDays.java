package de.oth.swgigbackend.menu.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.util.HashSet;
import java.util.Set;

@Embeddable
@DiscriminatorValue("REGULAR")
public class RegularServingDays extends ServingDays {
    @NotEmpty
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "menu_weekdays", joinColumns = @JoinColumn(name = "menu_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = {"menu_id", "weekday"}))
    @Enumerated(EnumType.STRING)
    @Column(name = "weekday", nullable = false)
    private Set<@NotNull DayOfWeek> regularDays;

    protected RegularServingDays() {
        super("REGULAR");
    }

    public RegularServingDays(Set<DayOfWeek> regularDays) {
        this();
        setRegularDays(regularDays);
    }

    public Set<DayOfWeek> getRegularDays() {
        return regularDays;
    }

    public void setRegularDays(Set<DayOfWeek> regularDays) {
        this.regularDays = regularDays == null ? null : new HashSet<>(regularDays);
    }
}
