import * as fc from "fast-check";
import {
  ComponentRegistry,
  getComponent,
} from "../../../src/components/Chat/componentRegistry";

// Import the actual components to verify they're correctly registered
import TokenSwap from "../../../src/components/TokenSwap";
import NetworkStatus from "../../../src/components/NetworkStatus";
import YourAssets from "../../../src/components/YourAssets";
import LendingSection from "../../../src/components/LendingSection";
import PerpetualsSection from "../../../src/components/PerpetualsSection";
import RecentActivity from "../../../src/components/RecentActivity";

describe("Component Registry", () => {
  describe("ComponentRegistry object", () => {
    it("contains all expected dashboard components", () => {
      expect(ComponentRegistry).toHaveProperty("TokenSwap");
      expect(ComponentRegistry).toHaveProperty("NetworkStatus");
      expect(ComponentRegistry).toHaveProperty("YourAssets");
      expect(ComponentRegistry).toHaveProperty("LendingSection");
      expect(ComponentRegistry).toHaveProperty("PerpetualsSection");
      expect(ComponentRegistry).toHaveProperty("RecentActivity");
    });

    it("maps component names to correct component references", () => {
      expect(ComponentRegistry["TokenSwap"]).toBe(TokenSwap);
      expect(ComponentRegistry["NetworkStatus"]).toBe(NetworkStatus);
      expect(ComponentRegistry["YourAssets"]).toBe(YourAssets);
      expect(ComponentRegistry["LendingSection"]).toBe(LendingSection);
      expect(ComponentRegistry["PerpetualsSection"]).toBe(PerpetualsSection);
      expect(ComponentRegistry["RecentActivity"]).toBe(RecentActivity);
    });
  });

  describe("getComponent function", () => {
    it("returns component for valid registered name", () => {
      expect(getComponent("TokenSwap")).toBe(TokenSwap);
      expect(getComponent("NetworkStatus")).toBe(NetworkStatus);
      expect(getComponent("YourAssets")).toBe(YourAssets);
      expect(getComponent("LendingSection")).toBe(LendingSection);
      expect(getComponent("PerpetualsSection")).toBe(PerpetualsSection);
      expect(getComponent("RecentActivity")).toBe(RecentActivity);
    });

    it("returns null for unregistered component name", () => {
      expect(getComponent("UnknownComponent")).toBeNull();
      expect(getComponent("FakeComponent")).toBeNull();
      expect(getComponent("NotAComponent")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getComponent("")).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(getComponent(undefined)).toBeNull();
    });

    it("returns null for null", () => {
      expect(getComponent(null)).toBeNull();
    });
  });

  // **Feature: chat-agent-ui, Property 15: Registry lookup behavior**
  // **Validates: Requirements 5.3, 5.4**
  describe("Property 15: Registry lookup behavior", () => {
    const validComponentNames = [
      "TokenSwap",
      "NetworkStatus",
      "YourAssets",
      "LendingSection",
      "PerpetualsSection",
      "RecentActivity",
    ];

    const componentMap = {
      TokenSwap: TokenSwap,
      NetworkStatus: NetworkStatus,
      YourAssets: YourAssets,
      LendingSection: LendingSection,
      PerpetualsSection: PerpetualsSection,
      RecentActivity: RecentActivity,
    };

    it("property: for any valid registered component name, getComponent returns the correct component", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validComponentNames), componentName => {
          const result = getComponent(componentName);
          // Should return the correct component reference
          expect(result).toBe(componentMap[componentName]);
          // Should not be null
          expect(result).not.toBeNull();
          // Should be a function (React components are functions)
          expect(typeof result).toBe("function");
        }),
        { numRuns: 100 }
      );
    });

    it("property: for any invalid/unregistered component name, getComponent returns null", () => {
      fc.assert(
        fc.property(
          // Generate random strings that are NOT valid component names
          fc.string().filter(name => !validComponentNames.includes(name)),
          componentName => {
            const result = getComponent(componentName);
            // Should return null for unregistered names
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("property: for any component name, getComponent is deterministic", () => {
      fc.assert(
        fc.property(fc.string(), componentName => {
          // Calling getComponent twice with the same name should return the same result
          const result1 = getComponent(componentName);
          const result2 = getComponent(componentName);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it("property: for any valid component name, the returned component is in the registry", () => {
      fc.assert(
        fc.property(fc.constantFrom(...validComponentNames), componentName => {
          const result = getComponent(componentName);
          // The returned component should be one of the values in ComponentRegistry
          const registryValues = Object.values(ComponentRegistry);
          expect(registryValues).toContain(result);
        }),
        { numRuns: 100 }
      );
    });

    it("property: registry lookup is case-sensitive", () => {
      // Test that lowercase versions of valid names return null
      validComponentNames.forEach(componentName => {
        const lowercase = componentName.toLowerCase();
        expect(getComponent(lowercase)).toBeNull();
      });

      // Test that uppercase versions of valid names return null
      validComponentNames.forEach(componentName => {
        const uppercase = componentName.toUpperCase();
        expect(getComponent(uppercase)).toBeNull();
      });

      // Property test: exact match required
      fc.assert(
        fc.property(fc.constantFrom(...validComponentNames), componentName => {
          // Valid name should return component
          const result = getComponent(componentName);
          expect(result).not.toBeNull();
          expect(result).toBe(componentMap[componentName]);
        }),
        { numRuns: 100 }
      );
    });

    it("property: all registry keys can be successfully looked up", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(ComponentRegistry)),
          registryKey => {
            const result = getComponent(registryKey);
            // Should return the component from the registry
            expect(result).toBe(ComponentRegistry[registryKey]);
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
