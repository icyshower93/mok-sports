/**
 * Robot Manager for Draft Testing
 * 
 * Creates and manages robot users for testing draft functionality:
 * - Creates 4 robot accounts automatically
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
      'Delta Bot'
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
    // Random delay between 1-4 seconds to simulate thinking
    return Math.random() * 3000 + 1000;
  }

  /**
   * Get robot preference for team selection
   * Robots have slight preferences for certain divisions/conferences
   */
  getRobotTeamPreference(robotId: string, availableTeams: any[]): any[] {
    const robot = this.robotUsers.find(r => r.id === robotId);
    if (!robot) return availableTeams;

    // Each robot has different preferences
    switch (robot.name) {
      case 'Alpha Bot':
        // Prefers AFC teams
        return availableTeams.sort((a, b) => 
          a.conference === 'AFC' ? -1 : (b.conference === 'AFC' ? 1 : 0)
        );
      
      case 'Beta Bot':
        // Prefers NFC teams
        return availableTeams.sort((a, b) => 
          a.conference === 'NFC' ? -1 : (b.conference === 'NFC' ? 1 : 0)
        );
      
      case 'Gamma Bot':
        // Prefers teams alphabetically
        return availableTeams.sort((a, b) => a.name.localeCompare(b.name));
      
      case 'Delta Bot':
        // Random preference (no sorting)
        return this.shuffleArray([...availableTeams]);
      
      default:
        return availableTeams;
    }
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