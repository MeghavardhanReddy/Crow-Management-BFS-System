# Crow-Management-BFS-System
Crowd Management System using BFS for LPU Summer Training 2025

# Crowd Management System Using Zone-Based BFS Graph Traversal

## Project Overview
The **Crowd Management System** is a summer training project developed at Lovely Professional University (LPU), School of Computer Science and Engineering, during June-July 2025. The system addresses safety concerns in crowded venues (e.g., LPU fests, temples,malls etc) by modeling venues as graphs, using Breadth-First Search (BFS) to find safe paths avoiding overcrowded zones (crowd > 100). It features real-time crowd updates, cloud analytics, and a React-based GUI for visualization, with an optimized input system to ensure seamless user interaction.

**Team Members**:  
- Manchikanti Meghavardhan Reddy (12318864, optimized Java implementation and input handling)  
- Prakriti Singh (12308985)  
- Prateek Kumar Sinha (12321106)  
- Lokesh Kumar Reddy (12301738)

**Mentors**: Anshu Sharma, Shilpa Sharma, Chirag Sharma.
**Course Code**: To be specified.
**Institution**: School of Computer Science and Engineering, Lovely Professional University, Punjab.

## Features
- **Graph Modeling**: Venues are represented as graphs with zones as nodes and paths as undirected edges.
- **BFS Pathfinding**: Finds up to three safe paths (crowd < 100) in O(V+E) time.
- **Real-Time Simulation**: Updates crowd counts every 5 seconds (edge) and analyzes density every 10 seconds (cloud).
- **React GUI**: Visualizes paths, heatmaps (red for crowd > 100), and alerts.
- **Input Optimization**: Delays simulation threads to ensure smooth user input, implemented by Manchikanti Meghavardhan Reddy.

## Test Case
- **Zones**: 
  - entry (ID: 0, crowd: 70)
  - hall1 (ID: 1, crowd: 95)
  - hall2 (ID: 2, crowd: 60)
  - exit (ID: 3, crowd: 55)
- **Paths**: 0-1, 1-2, 2-3
- **Entry/Exit**: 0 to 3
- **Output**: Safe path: `entry -> hall1 -> hall2 -> exit`
- **Alerts**: "Critical: Zone hall1 is overcrowded (104)!" (hall1 turns red in GUI)

## Installation
# Prerequisites
- **Hardware**: Laptop with 4GB RAM, 1GHz CPU
- **Software**: Java 8+, GCC, Node.js, Chrome browser
- **OS**: Windows, Linux, or Mac
