using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.DoctorPage
{
    public class patientModel : PageModel
    {
        public List<Patients> listPatients = new List<Patients>();
       
        public void OnGet()
        {
            String id = Request.Query["id"];

            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Patient where doctor_id=@id";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@id",Convert.ToInt32(id));
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                Patients patient = new Patients();
                                patient.id = reader.GetInt32(0);
                                patient.full_name = reader.GetString(1);
                                patient.year_of_birth = reader.GetString(2);
                                patient.Age = reader.GetInt32(3);
                                patient.Symptoms = reader.GetString(4);
                                patient.Allergies = reader.GetString(5);
                                patient.visit_date = reader.GetString(6);

                                listPatients.Add(patient);
                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }
        public void OnPost()
        {
            String id = Request.Query["id"];
            String doctorName = Request.Form["name"];
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Patient where doctor_id=@id and full_name LIKE '%@name%'";//Select all doctors 
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@id",Convert.ToInt32(id));
                        command.Parameters.AddWithValue("@name", doctorName);
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                listPatients.Clear();
                                Patients patient = new Patients();
                                patient.id = reader.GetInt32(0);
                                patient.full_name = reader.GetString(1);
                                patient.year_of_birth = reader.GetString(2);
                                patient.Age = reader.GetInt32(3);
                                patient.Symptoms = reader.GetString(4);
                                patient.Allergies = reader.GetString(5);
                                patient.visit_date = reader.GetString(6);
                                listPatients.Add(patient);
                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }
    }
    public class Patients
    {
        public int id;
        public String full_name;
        public String year_of_birth;
        public int Age;
        public String Symptoms;
        public String Allergies;
        public String visit_date;
        public int doctor_id;

    }
}

