package de.oth.swgigbackend.category.api;

import de.oth.swgigbackend.category.domain.Category;
import de.oth.swgigbackend.category.persistence.CategoryRepository;
import de.oth.swgigbackend.menu.domain.LifecycleStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// HTTP integration tests cover request mapping, validation and response contracts.
// MockMvc uses controller-relative paths; the servlet container adds the /api context path.
@SpringBootTest
@AutoConfigureMockMvc
class CategoryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired CategoryRepository categories;

    @AfterEach
    void cleanUp() {
        categories.deleteAll();
    }

    // POST accepts the DTO and exposes the saved category through the list endpoint.
    @Test
    void createsAndListsCategory() throws Exception {
        var request = new CategoryRequest("Getränke", "drinks", LifecycleStatus.DRAFT);

        mvc.perform(post("/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.displayName").value("Getränke"))
                .andExpect(jsonPath("$.internalName").value("drinks"))
                .andExpect(jsonPath("$.lifecycleStatus").value("DRAFT"));

        mvc.perform(get("/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].internalName").value("drinks"));
    }

    // Follow-up GETs verify that PUT and DELETE really commit changes, including archiving.
    @Test
    void updatesAndArchivesCategory() throws Exception {
        var category = save("drinks", LifecycleStatus.DRAFT);
        var request = new CategoryRequest("Kalte Getränke", "cold-drinks", LifecycleStatus.ACTIVE);

        mvc.perform(put("/categories/{id}", category.getId()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().isOk());

        mvc.perform(get("/categories/{id}", category.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Kalte Getränke"))
                .andExpect(jsonPath("$.internalName").value("cold-drinks"))
                .andExpect(jsonPath("$.lifecycleStatus").value("ACTIVE"));

        mvc.perform(delete("/categories/{id}", category.getId()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/categories/{id}", category.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lifecycleStatus").value("ARCHIVED"));
    }

    // A representative invalid field must be rejected by Bean Validation on POST and PUT.
    @Test
    void rejectsInvalidRequest() throws Exception {
        var body = json.writeValueAsString(new CategoryRequest("   ", "drinks", LifecycleStatus.DRAFT));

        mvc.perform(post("/categories").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/categories/{id}", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    // Translate the service's missing-category exception into an HTTP 404 problem response.
    @Test
    void returnsNotFoundForMissingCategory() throws Exception {
        mvc.perform(get("/categories/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Category not found"));
    }

    // Translate a name conflict into HTTP 409
    // Archived categories still reserve their names.
    @Test
    void returnsConflictForDuplicateInternalName() throws Exception {
        save("drinks", LifecycleStatus.ARCHIVED);
        var request = new CategoryRequest("Andere Anzeige", "drinks", LifecycleStatus.DRAFT);

        mvc.perform(post("/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Category internal name already exists"));
    }

    private Category save(String internalName, LifecycleStatus status) {
        return categories.saveAndFlush(new Category("Getränke", internalName, status));
    }
}
