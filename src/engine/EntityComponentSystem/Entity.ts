import { Component } from './Component';

import { Observable, Message } from '../Util/Observable';
import { Class } from '../Class';
import { ComponentType } from './ComponentTypes';
import { OnInitialize, OnPreUpdate, OnPostUpdate } from '../Interfaces/LifecycleEvents';
import { Engine } from '../Engine';
import { InitializeEvent, PreUpdateEvent, PostUpdateEvent } from '../Events';

export interface EntityComponent {
  component: Component;
  entity: Entity;
}
export class AddedComponent implements Message<EntityComponent> {
  readonly type: 'Component Added' = 'Component Added';
  constructor(public data: EntityComponent) {}
}

export function isAddedComponent(x: Message<EntityComponent>): x is AddedComponent {
  return !!x && x.type === 'Component Added';
}

export class RemovedComponent implements Message<EntityComponent> {
  readonly type: 'Component Removed' = 'Component Removed';
  constructor(public data: EntityComponent) {}
}

export function isRemovedComponent(x: Message<EntityComponent>): x is RemovedComponent {
  return !!x && x.type === 'Component Removed';
}

export type ComponentMap = { [type: string]: Component };

export class Entity extends Class implements OnInitialize, OnPreUpdate, OnPostUpdate  {
  private static _ID = 0;

  /**
   * The unique identifier for the entity
   */
  public id: number = Entity._ID++;

  /**
   * The types of the components on the Entity
   */
  public get types(): ComponentType[] {
    return Object.keys(this.components);
  }

  private _handleChanges = {
    defineProperty: (obj: any, prop: any, descriptor: PropertyDescriptor) => {
      this.changes.notifyAll(
        new AddedComponent({
          component: descriptor.value as Component,
          entity: this
        })
      );
      obj[prop] = descriptor.value;
      return true;
    },
    deleteProperty: (obj: any, prop: any) => {
      if (prop in obj) {
        this.changes.notifyAll(
          new RemovedComponent({
            component: obj[prop] as Component,
            entity: this
          })
        );
        delete obj[prop];
        return true;
      }
      return false;
    }
  };
  // not IE11 compatible...we can hack around this by triggering handle changes if needed
  // TODO maybe this should be read only to avoid using proxy...
  public components: ComponentMap = new Proxy({}, this._handleChanges);
  public changes: Observable<AddedComponent | RemovedComponent> = new Observable<AddedComponent | RemovedComponent>();

  /**
   * Creates a deep copy of the entity and a copy of all its components
   */
  public clone(): Entity {
    const newEntity = new Entity();
    for (const c in this.types) {
      newEntity.addComponent(this.components[c].clone());
    }
    return newEntity;
  }

  public addComponent(component: Component | Entity) {
    // If you use an entity as a "prefab" or template
    if (component instanceof Entity) {
      for (const c in component.components) {
        this.addComponent(component.components[c].clone());
      }
      // Normal component case
    } else {
      component.owner = this;
      this.components[component.type] = component;
      if (component.onAdd) {
        component.onAdd(this);
      }
    }
  }

  public removeComponent(componentOrType: string | Component) {
    if (typeof componentOrType === 'string') {
      if (this.components[componentOrType]) {
        this.components[componentOrType].owner = null;
        if (this.components[componentOrType].onRemove) {
          this.components[componentOrType].onRemove(this);
        }
        delete this.components[componentOrType];
      }
    } else {
      if (this.components[componentOrType.type]) {
        this.components[componentOrType.type].owner = null;
        if (this.components[componentOrType.type].onRemove) {
          this.components[componentOrType.type].onRemove(this);
        }
        delete this.components[componentOrType.type];
      }
    }
  }

  public has(type: ComponentType): boolean {
    return !!this.components[type];
  }


  private _isInitialized = false;
  
  /**
   * Gets whether the actor is Initialized
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Initializes this entity, meant to be called by the Scene before first update not by users of Excalibur.
   *
   * It is not recommended that internal excalibur methods be overriden, do so at your own risk.
   *
   * @internal
   */
  public _initialize(engine: Engine) {
    if (!this.isInitialized) {
      this.onInitialize(engine);
      super.emit('initialize', new InitializeEvent(engine, this));
      this._isInitialized = true;
    }
  }

  /**
   * It is not recommended that internal excalibur methods be overriden, do so at your own risk.
   *
   * Internal _preupdate handler for [[onPreUpdate]] lifecycle event
   * @internal
   */
  public _preupdate(engine: Engine, delta: number): void {
    this.emit('preupdate', new PreUpdateEvent(engine, delta, this));
    this.onPreUpdate(engine, delta);
  }

  /**
   * It is not recommended that internal excalibur methods be overriden, do so at your own risk.
   *
   * Internal _preupdate handler for [[onPostUpdate]] lifecycle event
   * @internal
   */
  public _postupdate(engine: Engine, delta: number): void {
    this.emit('postupdate', new PostUpdateEvent(engine, delta, this));
    this.onPostUpdate(engine, delta);
  }

  /**
   * `onInitialize` is called before the first update of the entity. This method is meant to be
   * overridden.
   *
   * Synonymous with the event handler `.on('initialize', (evt) => {...})`
   */
  public onInitialize(_engine: Engine): void {
    // Override me
  }

   /**
   * Safe to override onPreUpdate lifecycle event handler. Synonymous with `.on('preupdate', (evt) =>{...})`
   *
   * `onPreUpdate` is called directly before an entity is updated.
   */
  public onPreUpdate(_engine: Engine, _delta: number): void {
    // Override me
  }

  /**
   * Safe to override onPostUpdate lifecycle event handler. Synonymous with `.on('postupdate', (evt) =>{...})`
   *
   * `onPostUpdate` is called directly after an entity is updated.
   */
  public onPostUpdate(_engine: Engine, _delta: number): void {
    // Override me
  }
}