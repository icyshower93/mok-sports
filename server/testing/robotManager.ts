/**
 * Robot Manager for Draft Testing
 * 
 * Creates and manages robot users for testing draft functionality:
 * - Creates 5 robot accounts automatically
 * - Handles auto-drafting for robots
 * - Simulates realistic pick timing
 */

import { IStorage } from "../storage.js";
import type { User } from "../../shared/schema.js";

export interface RobotUser {
  id: string;
  name: string;
  email: string;
  isRobot: boolean;
}

export class RobotManager {
  private storage: IStorage;
  private robotUsers: RobotUser[] = [];

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Initialize robot users for testing
   */
  async initializeRobots(): Promise<RobotUser[]> {
    const robotNames = [
      'Alpha Bot',
      'Beta Bot', 
      'Gamma Bot',
      'Delta Bot',
      'Epsilon Bot'
    ];

    this.robotUsers = [];

    for (const name of robotNames) {
      const email = `${name.toLowerCase().replace(' ', '')}@mokdraft.test`;
      
      // Check if robot already exists
      let robot = await this.storage.getUserByEmail(email);
      
      if (!robot) {
        // Create robot user
        robot = await this.storage.createUser({
          googleId: `robot_${Date.now()}_${Math.random()}`,
          email,
          name,
          avatar: `https://api.dicebear.com/7.x/robots/svg?seed=${name}`
        });
      }

      this.robotUsers.push({
        id: robot.id,
        name: robot.name,
        email: robot.email,
        isRobot: true
      });
    }

    console.log(`[RobotManager] Initialized ${this.robotUsers.length} robot users`);
    return this.robotUsers;
  }

  /**
   * Get all robot users
   */
  getRobots(): RobotUser[] {
    return this.robotUsers;
  }

  /**
   * Check if a user ID belongs to a robot
   */
  isRobot(userId: string): boolean {
    return this.robotUsers.some(robot => robot.id === userId);
  }

  /**
   * Add robots to a specific league for testing
   */
  async addRobotsToLeague(leagueId: string): Promise<void> {
    if (this.robotUsers.length === 0) {
      await this.initializeRobots();
    }

    for (const robot of this.robotUsers) {
      try {
        // Check if robot is already in league
        const isAlreadyMember = await this.storage.isUserInLeague(robot.id, leagueId);
        
        if (!isAlreadyMember) {
          await this.storage.joinLeague({
            leagueId,
            userId: robot.id
          });
          console.log(`[RobotManager] Added ${robot.name} to league ${leagueId}`);
        }
      } catch (error) {
        console.error(`[RobotManager] Error adding ${robot.name} to league:`, error);
      }
    }
  }

  /**
   * Add one robot to a specific league for testing
   */
  async addOneRobotToLeague(leagueId: string): Promise<string> {
    if (this.robotUsers.length === 0) {
      await this.initializeRobots();
    }

    // Find the first robot that isn't already in the league
    for (const robot of this.robotUsers) {
      try {
        const isAlreadyMember = await this.storage.isUserInLeague(robot.id, leagueId);
        
        if (!isAlreadyMember) {
          await this.storage.joinLeague({
            leagueId,
            userId: robot.id
          });
          console.log(`[RobotManager] Added ${robot.name} to league ${leagueId}`);
          return robot.name;
        }
      } catch (error) {
        console.error(`[RobotManager] Error adding ${robot.name} to league:`, error);
      }
    }
    
    throw new Error('All robots are already in the league');
  }

  /**
   * Remove all robots from a league
   */
  async removeRobotsFromLeague(leagueId: string): Promise<void> {
    for (const robot of this.robotUsers) {
      try {
        await this.storage.leaveLeague(robot.id, leagueId);
        console.log(`[RobotManager] Removed ${robot.name} from league ${leagueId}`);
      } catch (error) {
        // Ignore errors - robot might not be in league
      }
    }
  }

  /**
   * Simulate robot decision-making for picks
   */
  simulateRobotPickDelay(): number {
    // Fixed 15 second delay for robot picks
    return 15000;
  }

  /**
   * Get robot preference for team selection
   * All robots use random selection while obeying draft rules
   */
  getRobotTeamPreference(robotId: string, availableTeams: any[]): any[] {
    // All robots now use random selection
    return this.shuffleArray([...availableTeams]);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}