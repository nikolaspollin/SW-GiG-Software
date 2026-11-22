package de.oth.swgigbackend.category.persistence;

import de.oth.swgigbackend.category.domain.Category;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class CategoryRepositoryTests {
    @Autowired CategoryRepository categories;

    // The database must enforce uniqueness even when callers bypass service-level checks.
    @Test
    void enforcesUniqueInternalName() {
        categories.saveAndFlush(new Category("Getränke", "drinks", LifecycleStatus.ARCHIVED));

        assertThatThrownBy(() -> categories.saveAndFlush(
                new Category("Andere Anzeige", "drinks", LifecycleStatus.DRAFT)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // Display names may be shared as long as the internal identifiers differ.
    @Test
    void allowsRepeatedDisplayName() {
        categories.saveAndFlush(new Category("Getränke", "cold-drinks", LifecycleStatus.DRAFT));
        categories.saveAndFlush(new Category("Getränke", "hot-drinks", LifecycleStatus.ACTIVE));

        assertThat(categories.existsByInternalName("cold-drinks")).isTrue();
        assertThat(categories.existsByInternalName("hot-drinks")).isTrue();
    }
}
