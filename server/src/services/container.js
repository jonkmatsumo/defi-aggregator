import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Service Container for dependency injection and service management
 * Provides centralized service registration, resolution, and lifecycle management
 */
export class ServiceContainer {
  constructor() {
    this.services = new Map(); // serviceName -> ServiceDefinition
    this.instances = new Map(); // serviceName -> instance
    this.singletons = new Set(); // serviceName for singleton services
    this.dependencies = new Map(); // serviceName -> [dependencyNames]
  }

  /**
   * Register a service with the container
   * @param {string} name - Service name
   * @param {Function} factory - Factory function to create service instance
   * @param {Object} options - Service options
   * @param {boolean} options.singleton - Whether service should be singleton
   * @param {Array<string>} options.dependencies - Service dependencies
   */
  register(name, factory, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new ServiceError('Service name must be a non-empty string');
    }

    if (typeof factory !== 'function') {
      throw new ServiceError('Service factory must be a function');
    }

    const { singleton = true, dependencies = [] } = options;

    this.services.set(name, {
      name,
      factory,
      dependencies
    });

    if (singleton) {
      this.singletons.add(name);
    }

    this.dependencies.set(name, dependencies);

    logger.debug('Service registered', { 
      serviceName: name, 
      singleton, 
      dependencies 
    });
  }

  /**
   * Get service instance, creating it if necessary
   * @param {string} name - Service name
   * @returns {Object} Service instance
   */
  get(name) {
    // Check if singleton instance already exists
    if (this.singletons.has(name) && this.instances.has(name)) {
      return this.instances.get(name);
    }

    const serviceDefinition = this.services.get(name);
    if (!serviceDefinition) {
      throw new ServiceError(`Service not found: ${name}`);
    }

    // Resolve dependencies
    const resolvedDependencies = this.resolveDependencies(name);

    try {
      // Create service instance
      const instance = serviceDefinition.factory(resolvedDependencies);

      // Store singleton instance
      if (this.singletons.has(name)) {
        this.instances.set(name, instance);
      }

      logger.debug('Service instance created', { serviceName: name });
      return instance;

    } catch (error) {
      logger.error('Failed to create service instance', {
        serviceName: name,
        error: error.message,
        stack: error.stack
      });
      throw new ServiceError(`Failed to create service ${name}: ${error.message}`);
    }
  }

  /**
   * Resolve service dependencies
   * @param {string} serviceName - Service name
   * @returns {Object} Resolved dependencies
   */
  resolveDependencies(serviceName) {
    const dependencies = this.dependencies.get(serviceName) || [];
    const resolved = {};

    // Check for circular dependencies
    this.checkCircularDependencies(serviceName, new Set());

    for (const depName of dependencies) {
      resolved[depName] = this.get(depName);
    }

    return resolved;
  }

  /**
   * Check for circular dependencies
   * @param {string} serviceName - Service name
   * @param {Set} visited - Visited services
   */
  checkCircularDependencies(serviceName, visited) {
    if (visited.has(serviceName)) {
      throw new ServiceError(`Circular dependency detected: ${Array.from(visited).join(' -> ')} -> ${serviceName}`);
    }

    visited.add(serviceName);
    const dependencies = this.dependencies.get(serviceName) || [];

    for (const depName of dependencies) {
      this.checkCircularDependencies(depName, new Set(visited));
    }
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   * @returns {Array<string>}
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services and instances
   */
  clear() {
    this.services.clear();
    this.instances.clear();
    this.singletons.clear();
    this.dependencies.clear();
    logger.debug('Service container cleared');
  }

  /**
   * Get container metrics
   * @returns {Object}
   */
  getMetrics() {
    return {
      registeredServices: this.services.size,
      activeInstances: this.instances.size,
      singletonServices: this.singletons.size,
      services: Array.from(this.services.keys())
    };
  }
}

// Global service container instance
export const serviceContainer = new ServiceContainer();