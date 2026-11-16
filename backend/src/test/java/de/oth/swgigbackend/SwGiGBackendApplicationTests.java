package de.oth.swgigbackend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Checks application startup and safe default guest access. */
@SpringBootTest
@AutoConfigureMockMvc
class SwGiGBackendApplicationTests {
    @Autowired MockMvc mvc;

    /** Confirms that application wiring starts successfully. */
    @Test
    void contextLoads() {
    }

    /** Keeps public demo credentials disabled without the demo profile. */
    @Test
    void demoCredentialsAreNotEnabledByDefault() throws Exception {
        mvc.perform(get("/api/order-drafts/current").header("Authorization", "Bearer demo-table-1"))
                .andExpect(status().isServiceUnavailable());
    }
}
