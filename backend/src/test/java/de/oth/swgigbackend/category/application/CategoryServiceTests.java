package de.oth.swgigbackend.category.application;

import de.oth.swgigbackend.category.api.CategoryRequest;
import de.oth.swgigbackend.category.domain.Category;
import de.oth.swgigbackend.category.persistence.CategoryRepository;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Service unit tests use a repository mock
// No Spring context or database is started.
class CategoryServiceTests {
    private final UUID categoryId = UUID.randomUUID();
    private final CategoryRepository repository = mock(CategoryRepository.class);
    private final CategoryService service = new CategoryService(repository);

    // Reject an existing internal name before attempting to persist a new category.
    @Test
    void rejectsDuplicateInternalNameOnCreate() {
        when(repository.existsByInternalName("drinks")).thenReturn(true);

        assertThatThrownBy(() -> service.createCategory(
                new CategoryRequest("Getränke", "drinks", LifecycleStatus.DRAFT)))
                .isInstanceOf(DuplicateCategoryInternalNameException.class);

        verify(repository, never()).save(any());
    }

    // Renaming to another category's name must fail without modifying the loaded entity.
    @Test
    void rejectsDuplicateRenameWithoutChangingCategory() {
        var category = new Category("Desserts", "desserts", LifecycleStatus.DRAFT);
        when(repository.findById(categoryId)).thenReturn(Optional.of(category));
        when(repository.existsByInternalNameAndIdNot("drinks", categoryId)).thenReturn(true);

        assertThatThrownBy(() -> service.updateCategory(categoryId,
                new CategoryRequest("Changed", "drinks", LifecycleStatus.ACTIVE)))
                .isInstanceOf(DuplicateCategoryInternalNameException.class);

        // Check that the loaded entity was not modified.
        assertThat(category.getDisplayName()).isEqualTo("Desserts");
        assertThat(category.getInternalName()).isEqualTo("desserts");
        assertThat(category.getLifecycleStatus()).isEqualTo(LifecycleStatus.DRAFT);
    }

    // Updating may retain the internal name, provided the uniqueness check excludes this ID.
    @Test
    void updatesCategoryKeepingItsInternalName() {
        var category = new Category("Getränke", "drinks", LifecycleStatus.DRAFT);
        when(repository.findById(categoryId)).thenReturn(Optional.of(category));
        when(repository.existsByInternalNameAndIdNot("drinks", categoryId)).thenReturn(false);

        var response = service.updateCategory(categoryId,
                new CategoryRequest("Kalte Getränke", "drinks", LifecycleStatus.ACTIVE));

        verify(repository).existsByInternalNameAndIdNot("drinks", categoryId);
        assertThat(response.displayName()).isEqualTo("Kalte Getränke");
        assertThat(response.internalName()).isEqualTo("drinks");
        assertThat(category.getLifecycleStatus()).isEqualTo(LifecycleStatus.ACTIVE);
    }

    // Archiving must go through DELETE rather than an ARCHIVED create/update request.
    @Test
    void rejectsArchivedStatusInCreateAndUpdate() {
        // Check category creation in archived state
        var request = new CategoryRequest("Changed", "changed", LifecycleStatus.ARCHIVED);
        assertThatThrownBy(() -> service.createCategory(request))
                .isInstanceOf(ArchivedCategoryException.class);
        verify(repository, never()).save(any());

        // Check category update to archived state
        var category = new Category("Getränke", "drinks", LifecycleStatus.ACTIVE);
        when(repository.findById(categoryId)).thenReturn(Optional.of(category));

        assertThatThrownBy(() -> service.updateCategory(categoryId, request))
                .isInstanceOf(ArchivedCategoryException.class);
        assertThat(category.getDisplayName()).isEqualTo("Getränke");
        assertThat(category.getInternalName()).isEqualTo("drinks");
        assertThat(category.getLifecycleStatus()).isEqualTo(LifecycleStatus.ACTIVE);
    }

    // An already archived category must remain unchanged when reactivation is attempted.
    @Test
    void rejectsChangesToArchivedCategory() {
        var category = new Category("Getränke", "drinks", LifecycleStatus.ARCHIVED);
        when(repository.findById(categoryId)).thenReturn(Optional.of(category));

        assertThatThrownBy(() -> service.updateCategory(categoryId,
                new CategoryRequest("Changed", "changed", LifecycleStatus.ACTIVE))
                ).isInstanceOf(ArchivedCategoryException.class);

        assertThat(category.getDisplayName()).isEqualTo("Getränke");
        assertThat(category.getInternalName()).isEqualTo("drinks");
        assertThat(category.getLifecycleStatus()).isEqualTo(LifecycleStatus.ARCHIVED);
    }

    // Read, update and delete all reject a missing category through the shared lookup.
    @Test
    void rejectsMissingCategory() {
        when(repository.findById(categoryId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCategory(categoryId))
                .isInstanceOf(CategoryNotFoundException.class);
        assertThatThrownBy(() -> service.updateCategory(categoryId,
                new CategoryRequest("Getränke", "drinks", LifecycleStatus.DRAFT)))
                .isInstanceOf(CategoryNotFoundException.class);
        assertThatThrownBy(() -> service.deleteCategory(categoryId))
                .isInstanceOf(CategoryNotFoundException.class);
    }
}
