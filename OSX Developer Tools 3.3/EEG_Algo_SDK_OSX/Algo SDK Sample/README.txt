"Algo SDK Sample" is a sample project to demonstrate how to manipulate data from MindWare Mobile Headset (realtime mode) or canned data (offline mode) and pass to EEG Algo SDK for EEG algorithm analysis. This document explains the use of "AlgoSdk.framework".

Running on Mac device (Realtime mode)
=====================================
NOTE: Make sure the macro “USE_CANNED_DATA” is commented out
1. Pairing NeuroSky MindWave Mobile Headset with Mac OS machine
2. Double click the Algo SDK Sample Xcode project (“Algo SDK Sample.xcodeproj”) to launch the project with Xcode
3. Select Product –> Run to build and install the “Algo SDK Sample” app
4. In the app,
	4.1. connect the headset to the app by pressing “Connect Headset” button
	4.2. select algorithm(s) from top left corner and tap “Set Algos” to initialise EEG Algo SDK (by invoking "setAlgorithmTypes:" method)
	4.2. press "Start“ to start process any incoming headset data (by invoking "startProcess:" method)
	4.3. press "Pause" to pause EEG Algo SDK (by invoking "pauseProcess:" method)
	4.4. press "Stop" to stop EEG Algo SDK (by invoking "stopProcess:" method)
	4.5. slide the slide bar to adjust the algorithm output interval (note: output interval of attention and meditation are fixed with 1 second), and then press “Interval” to set the output interval

Running on Mac device (Offline mode)
====================================
NOTE: Make sure the macro “USE_CANNED_DATA” is defined
1. Double click the Algo SDK Sample Xcode project (“Algo SDK Sample.xcodeproj”) to launch the project with Xcode
2. Select Product –> Run to build and install the “Algo SDK Sample” app
3. In the app,
	3.1. select algorithm(s) from top left corner and tap “Set Algos” to initialise EEG Algo SDK (by invoking "setAlgorithmTypes:" method)
	3.2. press "Start“ to start process any incoming headset data (by invoking "startProcess:" method)
	3.3. press “Bulk Data" to start feeding data to the EEG Algo SDK (by invoking “dataStream:” method) from "canned_data.c" and Algorithm Index output will be compared with the canned output in "canned_output.c"
	3.4. press "Stop" to stop EEG Algo SDK (by invoking "stopProcess:" method)
	3.5. slide the slide bar to adjust the algorithm output interval (note: output interval of attention and meditation are fixed with 1 second), and then press “Interval” to set the output interval