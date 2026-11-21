package de.oth.swgigbackend.category.application;

import de.oth.swgigbackend.category.api.CategoryRequest;
import de.oth.swgigbackend.category.api.CategoryResponse;
import de.oth.swgigbackend.category.domain.Category;
import de.oth.swgigbackend.category.persistence.CategoryRepository;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {
    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories() {
        return categoryRepository.findAll().stream().map(CategoryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategory(UUID categoryId) {
        return CategoryResponse.from(requireCategory(categoryId));
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        if (request.lifecycleStatus() == LifecycleStatus.ARCHIVED)
            throw new ArchivedCategoryException();

        if (categoryRepository.existsByInternalName(request.internalName()))
            throw new DuplicateCategoryInternalNameException();

        var category = new Category(request.displayName(), request.internalName(), request.lifecycleStatus());
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse updateCategory(UUID categoryId, CategoryRequest request) {
        var category = requireCategory(categoryId);
        if (category.getLifecycleStatus() == LifecycleStatus.ARCHIVED || request.lifecycleStatus() == LifecycleStatus.ARCHIVED)
            throw new ArchivedCategoryException();

        // Check if internal name is already taken by another category (even archived ones)
        if (categoryRepository.existsByInternalNameAndIdNot(request.internalName(), categoryId))
            throw new DuplicateCategoryInternalNameException();

        category.setDisplayName(request.displayName());
        category.setInternalName(request.internalName());
        category.setLifecycleStatus(request.lifecycleStatus());

        // Hibernate persists the changes when the transaction commits.
        return CategoryResponse.from(category);
    }

    @Transactional
    public void deleteCategory(UUID categoryId) {
        var category = requireCategory(categoryId);
        category.setLifecycleStatus(LifecycleStatus.ARCHIVED);
    }

    // Wrapper for exception throwing on not found
    private Category requireCategory(UUID categoryId) {
        return categoryRepository.findById(categoryId).orElseThrow(CategoryNotFoundException::new);
    }
}
