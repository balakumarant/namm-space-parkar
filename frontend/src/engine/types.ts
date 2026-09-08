export type CameraMode = 'fps' | 'tps';

export interface Vector3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface InteractiveZone {
  id: string;
  name: string;
  type: 'room' | 'elevator' | 'stairs' | 'info';
  position: Vector3Tuple;
  radius: number;
  prompt: string;
  onInteract?: () => void;
}

export interface RoomDefinition {
  id: string;
  number: string;
  name: string;
  floor: number;
  center: Vector3Tuple;
  size: Vector3Tuple;
  doorPosition: Vector3Tuple;
  color?: number;
}

export interface FloorDefinition {
  floorNumber: number;
  elevation: number;
  height: number;
  corridorLength: number;
  corridorWidth: number;
  rooms: RoomDefinition[];
  stairPosition: Vector3Tuple;
  elevatorPosition: Vector3Tuple;
}

export interface EngineCallbacks {
  onPlayerMove: (pos: Vector3Tuple, floor: number) => void;
  onFloorChange: (floor: number) => void;
  onInteractionPrompt: (prompt: string | null, zone: InteractiveZone | null) => void;
  onNotification: (message: string) => void;
  onLockStateChange: (isLocked: boolean) => void;
}
