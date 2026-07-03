import * as THREE from 'three';

export interface SelectionState {
  selectedTooth: number | null;
  hoveredTooth: number | null;
}

export class SelectionManager {
  private static instance: SelectionManager;
  private selectedTooth: number | null = null;
  private hoveredTooth: number | null = null;
  private listeners: ((state: SelectionState) => void)[] = [];

  private constructor() {}

  public static getInstance(): SelectionManager {
    if (!SelectionManager.instance) {
      SelectionManager.instance = new SelectionManager();
    }
    return SelectionManager.instance;
  }

  public getSelectionState(): SelectionState {
    return {
      selectedTooth: this.selectedTooth,
      hoveredTooth: this.hoveredTooth,
    };
  }

  public selectTooth(toothNumber: number | null) {
    this.selectedTooth = toothNumber;
    this.notify();
  }

  public hoverTooth(toothNumber: number | null) {
    this.hoveredTooth = toothNumber;
    this.notify();
  }

  public subscribe(callback: (state: SelectionState) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    const state = this.getSelectionState();
    this.listeners.forEach((l) => l(state));
  }

  // Auxiliar para obter propriedades de destaque (Highlight emissivo)
  public getHighlightProps(
    toothNumber: number,
    activeTooth: number | null,
    isHovered: boolean
  ) {
    const isSelected = activeTooth === toothNumber;
    if (isSelected) {
      return {
        emissive: new THREE.Color('#3B82F6'),
        emissiveIntensity: 0.6,
      };
    }
    if (isHovered) {
      return {
        emissive: new THREE.Color('#E0F2FE'),
        emissiveIntensity: 0.3,
      };
    }
    return {
      emissive: new THREE.Color('#000000'),
      emissiveIntensity: 0,
    };
  }
}
