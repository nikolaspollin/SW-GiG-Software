package de.oth.swgigbackend.menu.domain;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import org.hibernate.annotations.DiscriminatorFormula;

// JSON Mapping
// Allows Jackson to deduce the type of the serving days, depending on which data is provided in the request
// MenuRequest only needs to know the common base type
@JsonTypeInfo(use = JsonTypeInfo.Id.DEDUCTION)
@JsonSubTypes({
        @JsonSubTypes.Type(RegularServingDays.class),
        @JsonSubTypes.Type(FixedDateServingDays.class)
})
@Embeddable
// Evaluate expression / field to determine correct implementation (RegularServingDays or FixedDateServingDays)
@DiscriminatorFormula("serving_days_type")
public abstract class ServingDays {
    // Explicitly writable, so replacing the subtype also updates the stored discriminator.
    @JsonIgnore
    @Column(name = "serving_days_type", nullable = false)
    private String type;

    protected ServingDays() {}

    protected ServingDays(String type) {
        this.type = type;
    }
}
