package de.oth.swgigbackend.category.domain;

import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

@Entity
@Table(name = "categories", uniqueConstraints =
        @UniqueConstraint(name = "uk_category_internal_name", columnNames = "internal_name"))
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Size(max = 255)
    @Column(name = "display_name", nullable = false)
    private String displayName;

    @NotBlank
    @Size(max = 255)
    @Column(name = "internal_name", nullable = false)
    private String internalName;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LifecycleStatus lifecycleStatus;

    // Required for JPA / Hibernate
    protected Category() {}

    public Category(String displayName, String internalName, LifecycleStatus lifecycleStatus) {
        this.displayName = displayName;
        this.internalName = internalName;
        this.lifecycleStatus = lifecycleStatus;
    }

    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getInternalName() { return internalName; }
    public LifecycleStatus getLifecycleStatus() { return lifecycleStatus; }

    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public void setInternalName(String internalName) { this.internalName = internalName; }
    public void setLifecycleStatus(LifecycleStatus lifecycleStatus) { this.lifecycleStatus = lifecycleStatus; }
}
