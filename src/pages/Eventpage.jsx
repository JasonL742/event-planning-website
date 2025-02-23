import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "../../firebase.js";
import {
  Container,
  Card,
  Typography,
  Button,
  Avatar,
  Grid2,
  Box,
} from "@mui/material";
import { useUser } from "../utility/UserContext.jsx";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import apiUrl from "../utility/apiUrl.jsx";
import { useAlerts } from "../utility/AlertContext.jsx";

function EventPage() {
  const { addAlert } = useAlerts();
  const { eventId } = useParams();
  const [event, setEvents] = useState(null);
  const { user } = useUser();
  const [userRegisteredEvents, setUserRegisteredEvents] = useState([]);
  const navigate = useNavigate();

  const [mapsrc, setMapsrc] = useState("");
  const getMapSrc = (addr) => {
    const url = `${apiUrl.getMapUrl}?address=${encodeURIComponent(addr)}`;
    console.log(url);
    fetch(url, { method: "GET" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then((data) => {
        console.log("Map URL received:", data);
        setMapsrc(data);
      })
      .catch((error) => {
        console.error("Error fetching map data:", error);
      });
  };
  useEffect(() => {
    if (event && event.address) {
      if (mapsrc === "") {
        getMapSrc(event.address);
      }
    }
  }, [event]);

  useEffect(() => {
    const fetchEvent = async () => {
      const eventRef = doc(firestore, "events", eventId);
      const eventDoc = await getDoc(eventRef);

      if (eventDoc.exists()) {
        setEvents(eventDoc.data());
      } else {
        console.log("No such event!");
      }
    };

    const fetchRegisteredEvents = async () => {
      if (user) {
        const userDocRef = doc(firestore, "registered-events", user.uid);
        const userDocSnapshot = await getDoc(userDocRef);
        if (userDocSnapshot.exists()) {
          setUserRegisteredEvents(userDocSnapshot.data().eventIds || []);
        }
      }
    };

    fetchEvent();
    fetchRegisteredEvents();
  }, [eventId, user]);

  const handleRegister = async () => {
    if (!user) {
      addAlert("Please log in to register for an event.");
      return;
    }

    try {
      const userDocRef = doc(firestore, "registered-events", user.uid);
      await setDoc(
        userDocRef,
        {
          eventIds: arrayUnion(eventId),
        },
        { merge: true }
      );

      setUserRegisteredEvents((prev) => [...prev, eventId]);
      addAlert(`You have successfully registered for ${event.name}`);
    } catch (error) {
      console.error("Error registering for event:", error);
    }
  };

  const handleDeleteEvent = async (eventId, isHost, imagePath) => {
    if (isHost) {
      try {
        const userDocRef = doc(firestore, "registered-events", user.uid);
        await updateDoc(userDocRef, {
          eventIds: arrayRemove(eventId),
        });

        const eventDocRef = doc(firestore, "events", eventId);
        await deleteDoc(eventDocRef);

        const registeredEventsSnapshot = await getDocs(
          collection(firestore, "registered-events")
        );
        registeredEventsSnapshot.forEach(async (userDoc) => {
          const userEventIds = userDoc.data().eventIds || [];
          if (userEventIds.includes(eventId)) {
            const userDocRef = doc(firestore, "registered-events", userDoc.id);
            await updateDoc(userDocRef, {
              eventIds: arrayRemove(eventId),
            });
          }
        });

        if (imagePath) {
          const storage = getStorage();
          const imageRef = ref(storage, imagePath);
          await deleteObject(imageRef);
          console.log("Image deleted from Firebase Storage.");
        } else {
          console.log("No image path found for deletion.");
        }

        setEvents((prevEvents) =>
          prevEvents.filter((event) => event.id !== eventId)
        );

        addAlert("Event deleted, and image removed from storage.");
        navigate("/events");
      } catch (error) {
        console.error("Error deleting event and image:", error);
        addAlert("There was an error deleting the event and image.");
      }
    } else {
      try {
        const userDocRef = doc(firestore, "registered-events", user.uid);
        await updateDoc(userDocRef, {
          eventIds: arrayRemove(eventId),
        });

        setUserRegisteredEvents((prev) => prev.filter((id) => id !== eventId));
        addAlert("You have unregistered from this event.");
      } catch (error) {
        console.error("Error unregistering from event:", error);
      }
    }
  };

  if (!event) {
    return <div>Loading event...</div>;
  }

  const isRegistered = userRegisteredEvents.includes(eventId);
  const isHost = user && event.host === user.name;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Card sx={{ p: 3, mb: 3, backgroundColor: "#f9f9f9" }}>
        <Grid2 container spacing={2}>
          <Grid2 item xs={3}>
            <Avatar
              src={event.photo || "https://via.placeholder.com/150"}
              alt="Event"
              sx={{ width: 120, height: 120 }}
            />
          </Grid2>
          <Grid2 item xs={9}>
            <Typography variant="h4" gutterBottom>
              {event.name}
            </Typography>
            <Typography variant="body1" gutterBottom>
              <strong>Date:</strong> {event.date} <br />
              <strong>Time:</strong> {event.timeStart} - {event.timeEnd} <br />
              <strong>Location:</strong> {event.address}
            </Typography>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Button
                variant="contained"
                color="primary"
                sx={{ mr: 2 }}
                onClick={handleRegister}
                disabled={isRegistered || isHost}
              >
                {isHost
                  ? "Host - Cannot Register"
                  : isRegistered
                  ? "Already Registered"
                  : "Register"}
              </Button>

              <Button
                variant="contained"
                color="error"
                sx={{ ml: 2 }}
                onClick={() =>
                  isHost
                    ? handleDeleteEvent(eventId, true, event.photo)
                    : handleDeleteEvent(eventId)
                }
                disabled={!isRegistered}
              >
                {isHost ? "Delete Event" : "Unregister"}
              </Button>
            </Box>
          </Grid2>
        </Grid2>
      </Card>

      <Card sx={{ p: 3, mb: 3, backgroundColor: "#f9f9f9" }}>
        <Typography variant="h5" gutterBottom>
          About the Event
        </Typography>
        <Typography variant="body1">{event.description}</Typography>
      </Card>

      <Card sx={{ mb: 3, height: "450px" }}>
        {mapsrc ? (
          <iframe
            src={mapsrc}
            width="100%"
            height="100%"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        ) : (
          <div>Loading map...</div>
        )}
      </Card>
    </Container>
  );
}

export default EventPage;
