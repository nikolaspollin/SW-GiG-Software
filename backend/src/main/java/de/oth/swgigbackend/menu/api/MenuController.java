package de.oth.swgigbackend.menu.api;

import de.oth.swgigbackend.menu.application.MenuService;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/menus")
public class MenuController {

    private final MenuService menuService;

    public MenuController(MenuService menuService) {
        this.menuService = menuService;
    }

    @GetMapping
    public List<MenuResponse> getMenus() {
        return menuService.getMenus();
    }

    @GetMapping("/{menuId}")
    public MenuResponse getMenu(@PathVariable UUID menuId) {
        return menuService.getMenu(menuId);
    }

    @PostMapping
    public MenuResponse createMenu(@Valid @RequestBody MenuRequest request) {
        return menuService.createMenu(request);
    }

    @PutMapping("/{menuId}")
    public MenuResponse updateMenu(@PathVariable UUID menuId,
                                   @Valid @RequestBody MenuRequest request) {
        return menuService.updateMenu(menuId, request);
    }

    @DeleteMapping("/{menuId}")
    public ResponseEntity<Void> deleteMenu(@PathVariable UUID menuId) {
        menuService.deleteMenu(menuId);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
