// Component Registry for Chat Interface
// Maps component names to React component imports for dynamic rendering

import TokenSwap from "../TokenSwap";
import NetworkStatus from "../NetworkStatus";
import YourAssets from "../YourAssets";
import LendingSection from "../LendingSection";
import PerpetualsSection from "../PerpetualsSection";
import RecentActivity from "../RecentActivity";

/**
 * ComponentRegistry - Maps component names (strings) to React component references
 * This allows the chat interface to dynamically render components based on agent responses
 */
export const ComponentRegistry = {
  TokenSwap: TokenSwap,
  NetworkStatus: NetworkStatus,
  YourAssets: YourAssets,
  LendingSection: LendingSection,
  PerpetualsSection: PerpetualsSection,
  RecentActivity: RecentActivity,
};

/**
 * getComponent - Retrieves a component from the registry by name
 * @param {string} componentName - The name of the component to retrieve
 * @returns {React.Component|null} The component if found, null otherwise
 */
export function getComponent(componentName) {
  // Use hasOwnProperty to avoid returning inherited properties from Object.prototype
  if (ComponentRegistry.hasOwnProperty(componentName)) {
    return ComponentRegistry[componentName];
  }
  return null;
}
