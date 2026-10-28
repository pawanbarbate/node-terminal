import { ServiceConfig } from '../types/config.js';

export interface CommandPipeline {
  preCommands: string[];
  finalCommand: string;
  totalSteps: number;
}

export interface DependencyTiersResult {
  tiers: ServiceConfig[][];
  hasCycle: boolean;
  cycleNodes?: string[];
  missingDependencies: Map<string, string[]>; // serviceName -> missing dependency names
}

/**
 * Normalizes service commands into pre-flight commands and a final persistent daemon command.
 */
export function normalizeServiceCommands(service: ServiceConfig): CommandPipeline {
  // Case 1: Explicit commands array in service.commands
  if (Array.isArray(service.commands) && service.commands.length > 0) {
    const list = service.commands.map(c => String(c).trim()).filter(Boolean);
    if (list.length === 1) {
      return { preCommands: [], finalCommand: list[0]!, totalSteps: 1 };
    }
    return {
      preCommands: list.slice(0, -1),
      finalCommand: list[list.length - 1]!,
      totalSteps: list.length
    };
  }

  // Case 2: Array in service.command
  if (Array.isArray(service.command) && service.command.length > 0) {
    const list = service.command.map(c => String(c).trim()).filter(Boolean);
    if (list.length === 1) {
      return { preCommands: [], finalCommand: list[0]!, totalSteps: 1 };
    }
    return {
      preCommands: list.slice(0, -1),
      finalCommand: list[list.length - 1]!,
      totalSteps: list.length
    };
  }

  // Case 3: Explicit preStart + command string
  if (Array.isArray(service.preStart) && service.preStart.length > 0) {
    const pre = service.preStart.map(c => String(c).trim()).filter(Boolean);
    const finalCmd = typeof service.command === 'string' ? service.command.trim() : '';
    return {
      preCommands: pre,
      finalCommand: finalCmd,
      totalSteps: pre.length + (finalCmd ? 1 : 0)
    };
  }

  // Case 4: Standard single command string
  const single = typeof service.command === 'string' ? service.command.trim() : String(service.command || '').trim();
  return {
    preCommands: [],
    finalCommand: single,
    totalSteps: 1
  };
}

/**
 * Resolves service startup order using Kahn's algorithm with dependency tiering.
 * Tier 0 services can start immediately.
 * Tier 1 services start once their Tier 0 dependencies are ready.
 */
export function resolveDependencyTiers(services: ServiceConfig[]): DependencyTiersResult {
  const serviceMap = new Map<string, ServiceConfig>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // dependencyName -> services waiting for it
  const missingDependencies = new Map<string, string[]>();

  for (const s of services) {
    serviceMap.set(s.name.toLowerCase(), s);
    inDegree.set(s.name.toLowerCase(), 0);
    dependents.set(s.name.toLowerCase(), []);
  }

  // Build the dependency graph
  for (const s of services) {
    const sName = s.name.toLowerCase();
    const rawDeps = s.dependsOn || [];
    const missingForThis: string[] = [];

    for (const rawDep of rawDeps) {
      const depName = rawDep.trim().toLowerCase();
      if (!serviceMap.has(depName)) {
        missingForThis.push(rawDep);
        continue;
      }
      inDegree.set(sName, (inDegree.get(sName) || 0) + 1);
      dependents.get(depName)!.push(sName);
    }

    if (missingForThis.length > 0) {
      missingDependencies.set(s.name, missingForThis);
    }
  }

  // Kahn's algorithm: find nodes with in-degree 0
  const tiers: ServiceConfig[][] = [];
  let currentTierNames: string[] = [];

  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) {
      currentTierNames.push(name);
    }
  }

  let processedCount = 0;

  while (currentTierNames.length > 0) {
    const currentTierConfigs = currentTierNames
      .map(name => serviceMap.get(name)!)
      .filter(Boolean);
    tiers.push(currentTierConfigs);
    processedCount += currentTierNames.length;

    const nextTierNames: string[] = [];

    for (const node of currentTierNames) {
      for (const dependentName of dependents.get(node) || []) {
        const newDeg = (inDegree.get(dependentName) || 1) - 1;
        inDegree.set(dependentName, newDeg);
        if (newDeg === 0) {
          nextTierNames.push(dependentName);
        }
      }
    }

    currentTierNames = nextTierNames;
  }

  if (processedCount < services.length) {
    // Cycle detected in graph
    const cycleNodes = Array.from(inDegree.entries())
      .filter(([_, deg]) => deg > 0)
      .map(([name]) => serviceMap.get(name)?.name || name);

    return {
      tiers,
      hasCycle: true,
      cycleNodes,
      missingDependencies
    };
  }

  return {
    tiers,
    hasCycle: false,
    missingDependencies
  };
}

