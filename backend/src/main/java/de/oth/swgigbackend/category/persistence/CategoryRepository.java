package de.oth.swgigbackend.category.persistence;

import de.oth.swgigbackend.category.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    boolean existsByInternalName(String internalName);

    // Updates may keep their own name, but may not take another category's name.
    // Updating category itself must not be considered for duplicate internal names
    boolean existsByInternalNameAndIdNot(String internalName, UUID id);
}
