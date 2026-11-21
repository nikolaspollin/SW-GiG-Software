package de.oth.swgigbackend.menu.domain;

import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

@Entity
@Table(name = "menus")
public class Menu {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Column(nullable = false)
    private String name;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LifecycleStatus lifecycleStatus;

    @NotNull
    @Valid
    @Embedded
    private ServingDays servingDays;

    @NotNull
    @Valid
    // No standalone entity / no own identity => belongs to specific menu => flattened as database columns
    @Embedded
    private ServingTimeWindow servingTimeWindow;

    // Required for JPA / Hibernate
    protected Menu() {}

    // Application-specific constructor
    public Menu(String name, LifecycleStatus lifecycleStatus, ServingDays servingDays,
                ServingTimeWindow servingTimeWindow) {
        this.name = name;
        this.lifecycleStatus = lifecycleStatus;
        this.servingDays = servingDays;
        this.servingTimeWindow = servingTimeWindow;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public LifecycleStatus getLifecycleStatus() { return lifecycleStatus; }
    public ServingDays getServingDays() { return servingDays; }
    public ServingTimeWindow getServingTimeWindow() { return servingTimeWindow; }

    public void setName(String name) { this.name = name; }
    public void setLifecycleStatus(LifecycleStatus lifecycleStatus) { this.lifecycleStatus = lifecycleStatus; }
    public void setServingDays(ServingDays servingDays) { this.servingDays = servingDays; }
    public void setServingTimeWindow(ServingTimeWindow servingTimeWindow) { this.servingTimeWindow = servingTimeWindow; }
}
